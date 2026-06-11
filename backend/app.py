import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, g
from flask_cors import CORS

from database import get_db, init_db

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3004"}})

FRONTEND_PORT = 3004
BACKEND_PORT = 8004

ROLES = {
    'CREDIT_OFFICER': '信贷员',
    'RISK_AUDITOR': '风控审核员',
    'LOAN_SUPERVISOR': '贷后主管'
}

STATUSES = {
    'DRAFT': '草稿',
    'PENDING_VERIFICATION': '待核验',
    'VERIFICATION_PASSED': '核验完成',
    'VERIFICATION_FAILED': '核验失败',
    'CORRECTION_REQUIRED': '退回补正',
    'APPROVED': '审批通过',
    'REJECTED': '已拒绝',
    'COMPLETED': '已完成'
}

NODES = {
    'APPLICATION': '借款申请',
    'VERIFICATION': '资料核验',
    'APPROVAL': '审批放款'
}

REQUIRED_ATTACHMENTS = {
    'APPLICATION': ['ID_CARD', 'INCOME_PROOF'],
    'VERIFICATION': ['CREDIT_REPORT', 'VERIFICATION_RECORD'],
    'APPROVAL': ['APPROVAL_OPINION', 'DISBURSEMENT_VOUCHER']
}

ATTACHMENT_NAMES = {
    'ID_CARD': '身份证',
    'INCOME_PROOF': '收入证明',
    'CREDIT_REPORT': '征信报告',
    'VERIFICATION_RECORD': '核验记录',
    'APPROVAL_OPINION': '审批意见',
    'DISBURSEMENT_VOUCHER': '放款凭证'
}


def get_current_user():
    username = request.headers.get('X-User-Name')
    role = request.headers.get('X-User-Role')
    if not username or not role:
        return None
    return {'username': username, 'role': role, 'name': username}


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
    except ValueError:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return None


def get_due_status(due_date_str):
    if not due_date_str:
        return 'normal'
    due = parse_date(due_date_str)
    if not due:
        return 'normal'
    now = datetime.now()
    days_left = (due - now).days
    if days_left < 0:
        return 'overdue'
    elif days_left <= 3:
        return 'approaching'
    else:
        return 'normal'


def check_required_attachments(db, app_id, node):
    required = REQUIRED_ATTACHMENTS.get(node, [])
    if not required:
        return True, []
    cursor = db.execute(
        "SELECT attach_type FROM attachments WHERE loan_application_id = ?",
        (app_id,)
    )
    existing = [row['attach_type'] for row in cursor.fetchall()]
    missing = [r for r in required if r not in existing]
    return len(missing) == 0, missing


def validate_application_action(db, app, user, action_type, version=None, allow_no_version=False):
    """
    统一业务校验：角色权限、状态、版本、当前处理人、必填证据
    返回 (ok: bool, error_msg: str, error_type: str, missing: list)
    allow_no_version: 批量操作时不强制要求 version（逐条校验场景）
    """
    if not user:
        return False, '未登录', 'AUTH', []

    if not app:
        return False, '申请单不存在', 'NOT_FOUND', []

    if version is None and not allow_no_version:
        return False, '缺少版本号，请刷新页面后重试', 'VERSION_CONFLICT', []

    if version is not None and app['version'] != version:
        add_exception(db, app['id'], 'VERSION_CONFLICT', '版本冲突',
                      f'提交版本 {version}，当前版本 {app["version"]}', user['username'])
        return False, '版本冲突，请刷新后重试', 'VERSION_CONFLICT', []

    role = user['role']
    username = user['username']
    status = app['status']
    current_handler = app['current_handler']
    created_by = app['created_by']

    if action_type == 'SUBMIT':
        if role != 'CREDIT_OFFICER':
            return False, '只有信贷员可以提交申请', 'ROLE', []
        if status not in ['DRAFT', 'CORRECTION_REQUIRED']:
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许提交', 'STATUS', []
        if status == 'CORRECTION_REQUIRED' and created_by != username:
            return False, '只有创建人可以补正后重新提交', 'HANDLER', []
        ok, missing = check_required_attachments(db, app['id'], 'APPLICATION')
        if not ok:
            missing_names = [ATTACHMENT_NAMES.get(m, m) for m in missing]
            add_exception(db, app['id'], 'MISSING_EVIDENCE', '申请材料不全',
                          f'缺少: {", ".join(missing_names)}', user['username'])
            return False, '申请材料不全', 'MISSING_EVIDENCE', missing_names
        return True, '', '', []

    if action_type == 'VERIFY_PASS':
        if role != 'RISK_AUDITOR':
            return False, '只有风控审核员可以核验通过', 'ROLE', []
        if status != 'PENDING_VERIFICATION':
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许核验通过', 'STATUS', []
        if current_handler and current_handler != username:
            return False, f'当前处理人为 {current_handler}，您无权操作', 'HANDLER', []
        ver_due = parse_date(app['verification_due_date'])
        if ver_due and datetime.now() > ver_due:
            add_exception(db, app['id'], 'TIMEOUT', '核验超时',
                          f'核验时限 {app["verification_due_date"]}，已超时', user['username'])
            return False, '核验已超时，不允许通过，请退回补正', 'TIMEOUT', []
        ok, missing = check_required_attachments(db, app['id'], 'VERIFICATION')
        if not ok:
            missing_names = [ATTACHMENT_NAMES.get(m, m) for m in missing]
            add_exception(db, app['id'], 'MISSING_EVIDENCE', '核验证据不全',
                          f'缺少: {", ".join(missing_names)}', user['username'])
            return False, '核验证据不全', 'MISSING_EVIDENCE', missing_names
        ok2, missing2 = check_required_attachments(db, app['id'], 'APPLICATION')
        if not ok2:
            missing_names = [ATTACHMENT_NAMES.get(m, m) for m in missing2]
            return False, f'申请材料不齐全: {", ".join(missing_names)}', 'MISSING_EVIDENCE', missing_names
        return True, '', '', []

    if action_type == 'VERIFY_FAIL':
        if role != 'RISK_AUDITOR':
            return False, '只有风控审核员可以执行核验失败操作', 'ROLE', []
        if status != 'PENDING_VERIFICATION':
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许核验操作', 'STATUS', []
        if current_handler and current_handler != username:
            return False, f'当前处理人为 {current_handler}，您无权操作', 'HANDLER', []
        return True, '', '', []

    if action_type == 'VERIFY_RETURN':
        if role != 'RISK_AUDITOR':
            return False, '只有风控审核员可以退回补正', 'ROLE', []
        if status != 'PENDING_VERIFICATION':
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许退回操作', 'STATUS', []
        if current_handler and current_handler != username:
            return False, f'当前处理人为 {current_handler}，您无权操作', 'HANDLER', []
        return True, '', '', []

    if action_type == 'APPROVE':
        if role != 'LOAN_SUPERVISOR':
            return False, '只有贷后主管可以审批通过', 'ROLE', []
        if status != 'VERIFICATION_PASSED':
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许审批通过', 'STATUS', []
        if current_handler and current_handler != username:
            return False, f'当前处理人为 {current_handler}，您无权操作', 'HANDLER', []
        ok, missing = check_required_attachments(db, app['id'], 'APPROVAL')
        if not ok:
            missing_names = [ATTACHMENT_NAMES.get(m, m) for m in missing]
            add_exception(db, app['id'], 'MISSING_EVIDENCE', '审批证据不全',
                          f'缺少: {", ".join(missing_names)}', user['username'])
            return False, '审批证据不全', 'MISSING_EVIDENCE', missing_names
        ok2, missing2 = check_required_attachments(db, app['id'], 'VERIFICATION')
        if not ok2:
            missing_names = [ATTACHMENT_NAMES.get(m, m) for m in missing2]
            return False, f'核验证据不齐全: {", ".join(missing_names)}', 'MISSING_EVIDENCE', missing_names
        ok3, missing3 = check_required_attachments(db, app['id'], 'APPLICATION')
        if not ok3:
            missing_names = [ATTACHMENT_NAMES.get(m, m) for m in missing3]
            return False, f'申请材料不齐全: {", ".join(missing_names)}', 'MISSING_EVIDENCE', missing_names
        return True, '', '', []

    if action_type == 'REJECT':
        if role != 'LOAN_SUPERVISOR':
            return False, '只有贷后主管可以审批拒绝', 'ROLE', []
        if status != 'VERIFICATION_PASSED':
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许审批操作', 'STATUS', []
        if current_handler and current_handler != username:
            return False, f'当前处理人为 {current_handler}，您无权操作', 'HANDLER', []
        return True, '', '', []

    if action_type == 'APPROVE_RETURN':
        if role != 'LOAN_SUPERVISOR':
            return False, '只有贷后主管可以退回补正', 'ROLE', []
        if status != 'VERIFICATION_PASSED':
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许退回操作', 'STATUS', []
        if current_handler and current_handler != username:
            return False, f'当前处理人为 {current_handler}，您无权操作', 'HANDLER', []
        return True, '', '', []

    if action_type == 'COMPLETE':
        if role != 'LOAN_SUPERVISOR':
            return False, '只有贷后主管可以完成放款', 'ROLE', []
        if status != 'APPROVED':
            return False, f'当前状态 {STATUSES.get(status, status)} 不允许完成操作', 'STATUS', []
        return True, '', '', []

    return False, '未知操作类型', 'UNKNOWN', []


def record_process(db, app_id, action, from_status, to_status, handler, handler_role, node, remark=None):
    db.execute(
        '''INSERT INTO processing_records
           (loan_application_id, action, from_status, to_status, handler, handler_role, node, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (app_id, action, from_status, to_status, handler, handler_role, node, remark)
    )


def add_exception(db, app_id, exc_type, reason, detail, detected_by):
    db.execute(
        '''INSERT INTO exception_reasons
           (loan_application_id, exception_type, reason, detail, detected_by)
           VALUES (?, ?, ?, ?, ?)''',
        (app_id, exc_type, reason, detail, detected_by)
    )


def update_application_status(db, app_id, new_status, new_node=None, new_handler=None, version=None):
    updates = ['status = ?', 'updated_at = datetime("now", "localtime")', 'version = version + 1']
    params = [new_status]

    if new_node:
        updates.append('current_node = ?')
        params.append(new_node)
    if new_handler is not None:
        updates.append('current_handler = ?')
        params.append(new_handler)

    params.append(app_id)
    where = ['id = ?']
    if version is not None:
        where.append('version = ?')
        params.append(version)

    query = f"UPDATE loan_applications SET {', '.join(updates)} WHERE {' AND '.join(where)}"
    cursor = db.execute(query, params)
    return cursor.rowcount > 0


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        (username, password)
    ).fetchone()

    if not user:
        return jsonify({'error': '用户名或密码错误'}), 401

    return jsonify({
        'username': user['username'],
        'name': user['name'],
        'role': user['role'],
        'roleName': ROLES.get(user['role'], user['role'])
    })


@app.route('/api/users', methods=['GET'])
def list_users():
    db = get_db()
    users = db.execute("SELECT id, username, name, role FROM users").fetchall()
    return jsonify([dict(u) for u in users])


@app.route('/api/applications', methods=['GET'])
def list_applications():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    db = get_db()
    status = request.args.get('status')
    node = request.args.get('node')
    keyword = request.args.get('keyword')
    due_status = request.args.get('due_status')

    query = "SELECT * FROM loan_applications WHERE 1=1"
    params = []

    if status:
        query += " AND status = ?"
        params.append(status)
    if node:
        query += " AND current_node = ?"
        params.append(node)
    if keyword:
        query += " AND (applicant_name LIKE ? OR application_no LIKE ? OR id_card LIKE ?)"
        kw = f'%{keyword}%'
        params.extend([kw, kw, kw])

    query += " ORDER BY created_at DESC"

    rows = db.execute(query, params).fetchall()
    results = []
    for row in rows:
        d = dict(row)
        d['statusName'] = STATUSES.get(d['status'], d['status'])
        d['nodeName'] = NODES.get(d['current_node'], d['current_node'])
        d['dueStatus'] = get_due_status(d.get('verification_due_date') or d.get('due_date'))
        results.append(d)

    if due_status:
        results = [r for r in results if r['dueStatus'] == due_status]

    return jsonify(results)


@app.route('/api/applications/stats', methods=['GET'])
def application_stats():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    db = get_db()
    stats = {}

    for status in STATUSES:
        count = db.execute(
            "SELECT COUNT(*) as cnt FROM loan_applications WHERE status = ?",
            (status,)
        ).fetchone()['cnt']
        stats[status] = count

    rows = db.execute("SELECT * FROM loan_applications").fetchall()
    due_stats = {'normal': 0, 'approaching': 0, 'overdue': 0}
    for row in rows:
        ds = get_due_status(row['verification_due_date'] or row['due_date'])
        due_stats[ds] += 1

    return jsonify({
        'byStatus': stats,
        'byDue': due_stats,
        'total': len(rows)
    })


@app.route('/api/applications/<int:app_id>', methods=['GET'])
def get_application(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    db = get_db()
    row = db.execute(
        "SELECT * FROM loan_applications WHERE id = ?",
        (app_id,)
    ).fetchone()

    if not row:
        return jsonify({'error': '申请单不存在'}), 404

    d = dict(row)
    d['statusName'] = STATUSES.get(d['status'], d['status'])
    d['nodeName'] = NODES.get(d['current_node'], d['current_node'])
    d['dueStatus'] = get_due_status(d.get('verification_due_date') or d.get('due_date'))

    attachments = db.execute(
        "SELECT * FROM attachments WHERE loan_application_id = ? ORDER BY uploaded_at",
        (app_id,)
    ).fetchall()
    d['attachments'] = [dict(a) for a in attachments]

    records = db.execute(
        "SELECT * FROM processing_records WHERE loan_application_id = ? ORDER BY created_at DESC",
        (app_id,)
    ).fetchall()
    d['records'] = [dict(r) for r in records]

    audit_notes = db.execute(
        "SELECT * FROM audit_notes WHERE loan_application_id = ? ORDER BY created_at DESC",
        (app_id,)
    ).fetchall()
    d['auditNotes'] = [dict(a) for a in audit_notes]

    exceptions = db.execute(
        "SELECT * FROM exception_reasons WHERE loan_application_id = ? ORDER BY detected_at DESC",
        (app_id,)
    ).fetchall()
    d['exceptions'] = [dict(e) for e in exceptions]

    missing_by_node = {}
    for node in NODES:
        ok, missing = check_required_attachments(db, app_id, node)
        missing_by_node[node] = {
            'complete': ok,
            'missing': [{'type': m, 'name': ATTACHMENT_NAMES.get(m, m)} for m in missing]
        }
    d['evidenceSummary'] = missing_by_node

    return jsonify(d)


@app.route('/api/applications', methods=['POST'])
def create_application():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401
    if user['role'] != 'CREDIT_OFFICER':
        return jsonify({'error': '只有信贷员可以创建申请单'}), 403

    data = request.get_json()
    db = get_db()

    import random
    app_no = f'LA{datetime.now().strftime("%Y%m%d")}{random.randint(1000, 9999)}'

    due_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    ver_due = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')

    cursor = db.execute(
        '''INSERT INTO loan_applications
           (application_no, applicant_name, id_card, phone, amount, purpose,
            term_months, status, current_node, current_handler, created_by,
            verification_due_date, due_date, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'APPLICATION', ?, ?, ?, ?, ?)''',
        (app_no, data.get('applicant_name', ''), data.get('id_card', ''),
         data.get('phone', ''), data.get('amount', 0), data.get('purpose', ''),
         data.get('term_months', 12), user['username'], user['username'],
         ver_due, due_date, data.get('remark', ''))
    )

    app_id = cursor.lastrowid
    record_process(db, app_id, 'CREATE', None, 'DRAFT', user['username'],
                   user['role'], 'APPLICATION', '创建申请单')
    db.commit()

    return jsonify({'id': app_id, 'application_no': app_no})


@app.route('/api/applications/<int:app_id>/submit', methods=['POST'])
def submit_application(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}
    version = data.get('version')

    db = get_db()
    app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()

    ok, err_msg, err_type, missing = validate_application_action(db, app, user, 'SUBMIT', version)
    if not ok:
        db.commit()
        status_code = 409 if err_type == 'VERSION_CONFLICT' else 400
        resp = {'error': err_msg}
        if missing:
            resp['missing'] = missing
        return jsonify(resp), status_code

    if app['status'] == 'DRAFT':
        action_name = 'SUBMIT'
        from_status = 'DRAFT'
    else:
        action_name = 'RESUBMIT'
        from_status = 'CORRECTION_REQUIRED'

    success = update_application_status(
        db, app_id, 'PENDING_VERIFICATION', new_node='VERIFICATION',
        new_handler='risk_auditor_01', version=version
    )
    if not success:
        db.rollback()
        return jsonify({'error': '更新失败，请刷新重试'}), 409

    record_process(db, app_id, action_name, from_status, 'PENDING_VERIFICATION',
                   user['username'], user['role'], 'VERIFICATION', data.get('remark'))
    db.commit()

    return jsonify({'success': True, 'id': app_id})


@app.route('/api/applications/<int:app_id>/verify', methods=['POST'])
def verify_application(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}
    action = data.get('action', 'PASS')
    version = data.get('version')
    remark = data.get('remark', '')

    db = get_db()
    app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()

    action_map = {'PASS': 'VERIFY_PASS', 'FAIL': 'VERIFY_FAIL', 'RETURN': 'VERIFY_RETURN'}
    action_type = action_map.get(action)
    if not action_type:
        return jsonify({'error': '无效的操作'}), 400

    ok, err_msg, err_type, missing = validate_application_action(db, app, user, action_type, version)
    if not ok:
        db.commit()
        status_code = 409 if err_type == 'VERSION_CONFLICT' else 400
        resp = {'error': err_msg}
        if missing:
            resp['missing'] = missing
        return jsonify(resp), status_code

    if action == 'PASS':
        success = update_application_status(
            db, app_id, 'VERIFICATION_PASSED', new_node='APPROVAL',
            new_handler='supervisor_01', version=version
        )
        if not success:
            db.rollback()
            return jsonify({'error': '更新失败，请刷新重试'}), 409
        record_process(db, app_id, 'VERIFY_PASS', 'PENDING_VERIFICATION',
                       'VERIFICATION_PASSED', user['username'], user['role'],
                       'APPROVAL', remark)

    elif action == 'FAIL':
        success = update_application_status(
            db, app_id, 'VERIFICATION_FAILED', new_node='VERIFICATION',
            new_handler=None, version=version
        )
        if not success:
            db.rollback()
            return jsonify({'error': '更新失败，请刷新重试'}), 409
        add_exception(db, app_id, 'VERIFICATION_FAILED', '核验失败', remark, user['username'])
        record_process(db, app_id, 'VERIFY_FAIL', 'PENDING_VERIFICATION',
                       'VERIFICATION_FAILED', user['username'], user['role'],
                       'VERIFICATION', remark)

    elif action == 'RETURN':
        success = update_application_status(
            db, app_id, 'CORRECTION_REQUIRED', new_node='APPLICATION',
            new_handler=app['created_by'], version=version
        )
        if not success:
            db.rollback()
            return jsonify({'error': '更新失败，请刷新重试'}), 409
        add_exception(db, app_id, 'RETURNED', '退回补正', remark, user['username'])
        record_process(db, app_id, 'RETURN_CORRECTION', 'PENDING_VERIFICATION',
                       'CORRECTION_REQUIRED', user['username'], user['role'],
                       'APPLICATION', remark)

    db.commit()
    return jsonify({'success': True, 'id': app_id})


@app.route('/api/applications/<int:app_id>/approve', methods=['POST'])
def approve_application(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}
    action = data.get('action', 'APPROVE')
    version = data.get('version')
    remark = data.get('remark', '')

    db = get_db()
    app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()

    action_map = {'APPROVE': 'APPROVE', 'REJECT': 'REJECT', 'RETURN': 'APPROVE_RETURN'}
    action_type = action_map.get(action)
    if not action_type:
        return jsonify({'error': '无效的操作'}), 400

    ok, err_msg, err_type, missing = validate_application_action(db, app, user, action_type, version)
    if not ok:
        db.commit()
        status_code = 409 if err_type == 'VERSION_CONFLICT' else 400
        resp = {'error': err_msg}
        if missing:
            resp['missing'] = missing
        return jsonify(resp), status_code

    if action == 'APPROVE':
        success = update_application_status(
            db, app_id, 'APPROVED', new_node='APPROVAL',
            new_handler=user['username'], version=version
        )
        if not success:
            db.rollback()
            return jsonify({'error': '更新失败，请刷新重试'}), 409
        record_process(db, app_id, 'APPROVE', 'VERIFICATION_PASSED',
                       'APPROVED', user['username'], user['role'],
                       'APPROVAL', remark)

    elif action == 'REJECT':
        success = update_application_status(
            db, app_id, 'REJECTED', new_node='APPROVAL',
            new_handler=None, version=version
        )
        if not success:
            db.rollback()
            return jsonify({'error': '更新失败，请刷新重试'}), 409
        add_exception(db, app_id, 'REJECTED', '审批拒绝', remark, user['username'])
        record_process(db, app_id, 'REJECT', 'VERIFICATION_PASSED',
                       'REJECTED', user['username'], user['role'],
                       'APPROVAL', remark)

    elif action == 'RETURN':
        success = update_application_status(
            db, app_id, 'CORRECTION_REQUIRED', new_node='VERIFICATION',
            new_handler='risk_auditor_01', version=version
        )
        if not success:
            db.rollback()
            return jsonify({'error': '更新失败，请刷新重试'}), 409
        add_exception(db, app_id, 'RETURNED', '退回补正', remark, user['username'])
        record_process(db, app_id, 'RETURN_CORRECTION', 'VERIFICATION_PASSED',
                       'CORRECTION_REQUIRED', user['username'], user['role'],
                       'VERIFICATION', remark)

    db.commit()
    return jsonify({'success': True, 'id': app_id})


@app.route('/api/applications/<int:app_id>/complete', methods=['POST'])
def complete_application(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}
    version = data.get('version')

    db = get_db()
    app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()

    ok, err_msg, err_type, missing = validate_application_action(db, app, user, 'COMPLETE', version)
    if not ok:
        db.commit()
        status_code = 409 if err_type == 'VERSION_CONFLICT' else 400
        resp = {'error': err_msg}
        if missing:
            resp['missing'] = missing
        return jsonify(resp), status_code

    success = update_application_status(
        db, app_id, 'COMPLETED', new_node='APPROVAL',
        new_handler=None, version=version
    )
    if not success:
        db.rollback()
        return jsonify({'error': '更新失败，请刷新重试'}), 409

    record_process(db, app_id, 'COMPLETE', 'APPROVED', 'COMPLETED',
                   user['username'], user['role'], 'APPROVAL', '放款完成')
    db.commit()

    return jsonify({'success': True, 'id': app_id})


@app.route('/api/batch/verify', methods=['POST'])
def batch_verify():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401
    if user['role'] != 'RISK_AUDITOR':
        return jsonify({'error': '只有风控审核员可以批量核验'}), 403

    data = request.get_json() or {}
    ids = data.get('ids', [])
    action = data.get('action', 'PASS')
    remark = data.get('remark', '')

    action_map = {'PASS': 'VERIFY_PASS', 'FAIL': 'VERIFY_FAIL', 'RETURN': 'VERIFY_RETURN'}
    action_type = action_map.get(action)
    if not action_type:
        return jsonify({'error': '无效的操作'}), 400

    results = []
    for app_id in ids:
        try:
            db = get_db()
            app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()

            ok, err_msg, err_type, _ = validate_application_action(
                db, app, user, action_type, allow_no_version=True)
            if not ok:
                results.append({'id': app_id, 'success': False, 'reason': err_msg})
                db.commit()
                continue

            if action == 'PASS':
                success = update_application_status(
                    db, app_id, 'VERIFICATION_PASSED', new_node='APPROVAL',
                    new_handler='supervisor_01', version=app['version']
                )
                if not success:
                    results.append({'id': app_id, 'success': False, 'reason': '更新失败'})
                    continue
                record_process(db, app_id, 'BATCH_VERIFY_PASS', 'PENDING_VERIFICATION',
                               'VERIFICATION_PASSED', user['username'], user['role'],
                               'APPROVAL', remark + ' (批量处理)')
                results.append({'id': app_id, 'success': True, 'status': 'VERIFICATION_PASSED'})

            elif action == 'FAIL':
                success = update_application_status(
                    db, app_id, 'VERIFICATION_FAILED', new_node='VERIFICATION',
                    new_handler=None, version=app['version']
                )
                if not success:
                    results.append({'id': app_id, 'success': False, 'reason': '更新失败'})
                    continue
                add_exception(db, app_id, 'VERIFICATION_FAILED', '核验失败(批量)', remark, user['username'])
                record_process(db, app_id, 'BATCH_VERIFY_FAIL', 'PENDING_VERIFICATION',
                               'VERIFICATION_FAILED', user['username'], user['role'],
                               'VERIFICATION', remark + ' (批量处理)')
                results.append({'id': app_id, 'success': True, 'status': 'VERIFICATION_FAILED'})

            elif action == 'RETURN':
                success = update_application_status(
                    db, app_id, 'CORRECTION_REQUIRED', new_node='APPLICATION',
                    new_handler=app['created_by'], version=app['version']
                )
                if not success:
                    results.append({'id': app_id, 'success': False, 'reason': '更新失败'})
                    continue
                add_exception(db, app_id, 'RETURNED', '退回补正(批量)', remark, user['username'])
                record_process(db, app_id, 'BATCH_RETURN', 'PENDING_VERIFICATION',
                               'CORRECTION_REQUIRED', user['username'], user['role'],
                               'APPLICATION', remark + ' (批量处理)')
                results.append({'id': app_id, 'success': True, 'status': 'CORRECTION_REQUIRED'})

            db.commit()
        except Exception as e:
            results.append({'id': app_id, 'success': False, 'reason': str(e)})

    return jsonify({
        'total': len(ids),
        'successCount': sum(1 for r in results if r['success']),
        'failCount': sum(1 for r in results if not r['success']),
        'results': results
    })


@app.route('/api/batch/approve', methods=['POST'])
def batch_approve():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401
    if user['role'] != 'LOAN_SUPERVISOR':
        return jsonify({'error': '只有贷后主管可以批量审批'}), 403

    data = request.get_json() or {}
    ids = data.get('ids', [])
    action = data.get('action', 'APPROVE')
    remark = data.get('remark', '')

    action_map = {'APPROVE': 'APPROVE', 'REJECT': 'REJECT', 'RETURN': 'APPROVE_RETURN'}
    action_type = action_map.get(action)
    if not action_type:
        return jsonify({'error': '无效的操作'}), 400

    results = []
    for app_id in ids:
        try:
            db = get_db()
            app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()

            ok, err_msg, err_type, _ = validate_application_action(
                db, app, user, action_type, allow_no_version=True)
            if not ok:
                results.append({'id': app_id, 'success': False, 'reason': err_msg})
                db.commit()
                continue

            if action == 'APPROVE':
                success = update_application_status(
                    db, app_id, 'APPROVED', new_node='APPROVAL',
                    new_handler=user['username'], version=app['version']
                )
                if not success:
                    results.append({'id': app_id, 'success': False, 'reason': '更新失败'})
                    continue
                record_process(db, app_id, 'BATCH_APPROVE', 'VERIFICATION_PASSED',
                               'APPROVED', user['username'], user['role'],
                               'APPROVAL', remark + ' (批量处理)')
                results.append({'id': app_id, 'success': True, 'status': 'APPROVED'})

            elif action == 'REJECT':
                success = update_application_status(
                    db, app_id, 'REJECTED', new_node='APPROVAL',
                    new_handler=None, version=app['version']
                )
                if not success:
                    results.append({'id': app_id, 'success': False, 'reason': '更新失败'})
                    continue
                add_exception(db, app_id, 'REJECTED', '审批拒绝(批量)', remark, user['username'])
                record_process(db, app_id, 'BATCH_REJECT', 'VERIFICATION_PASSED',
                               'REJECTED', user['username'], user['role'],
                               'APPROVAL', remark + ' (批量处理)')
                results.append({'id': app_id, 'success': True, 'status': 'REJECTED'})

            elif action == 'RETURN':
                success = update_application_status(
                    db, app_id, 'CORRECTION_REQUIRED', new_node='VERIFICATION',
                    new_handler='risk_auditor_01', version=app['version']
                )
                if not success:
                    results.append({'id': app_id, 'success': False, 'reason': '更新失败'})
                    continue
                add_exception(db, app_id, 'RETURNED', '退回补正(批量)', remark, user['username'])
                record_process(db, app_id, 'BATCH_RETURN', 'VERIFICATION_PASSED',
                               'CORRECTION_REQUIRED', user['username'], user['role'],
                               'VERIFICATION', remark + ' (批量处理)')
                results.append({'id': app_id, 'success': True, 'status': 'CORRECTION_REQUIRED'})

            db.commit()
        except Exception as e:
            results.append({'id': app_id, 'success': False, 'reason': str(e)})

    return jsonify({
        'total': len(ids),
        'successCount': sum(1 for r in results if r['success']),
        'failCount': sum(1 for r in results if not r['success']),
        'results': results
    })


@app.route('/api/applications/<int:app_id>/attachments', methods=['GET'])
def list_attachments(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    db = get_db()
    rows = db.execute(
        "SELECT * FROM attachments WHERE loan_application_id = ? ORDER BY uploaded_at",
        (app_id,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


NODE_ATTACHMENT_RULES = {
    'APPLICATION': {
        'allowed_roles': ['CREDIT_OFFICER'],
        'allowed_statuses': ['DRAFT', 'CORRECTION_REQUIRED'],
        'allowed_types': ['ID_CARD', 'INCOME_PROOF'],
    },
    'VERIFICATION': {
        'allowed_roles': ['RISK_AUDITOR'],
        'allowed_statuses': ['PENDING_VERIFICATION', 'CORRECTION_REQUIRED',
                             'VERIFICATION_PASSED', 'VERIFICATION_FAILED'],
        'allowed_types': ['CREDIT_REPORT', 'VERIFICATION_RECORD'],
    },
    'APPROVAL': {
        'allowed_roles': ['LOAN_SUPERVISOR'],
        'allowed_statuses': ['VERIFICATION_PASSED', 'APPROVED'],
        'allowed_types': ['APPROVAL_OPINION', 'DISBURSEMENT_VOUCHER'],
    },
}


@app.route('/api/applications/<int:app_id>/attachments', methods=['POST'])
def add_attachment(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}
    node = data.get('node', 'APPLICATION')
    attach_type = data.get('attach_type', '')
    db = get_db()

    app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()
    if not app:
        return jsonify({'error': '申请单不存在'}), 404

    rules = NODE_ATTACHMENT_RULES.get(node)
    if not rules:
        return jsonify({'error': f'无效的证据节点: {node}'}), 400

    if user['role'] not in rules['allowed_roles']:
        node_label = NODES.get(node, node)
        return jsonify({'error': f'当前角色无权上传{node_label}证据'}), 403

    if app['status'] not in rules['allowed_statuses']:
        return jsonify({
            'error': f'当前状态 {STATUSES.get(app["status"], app["status"])} 不允许上传该节点证据'
        }), 400

    if node == 'APPLICATION' and user['role'] == 'CREDIT_OFFICER':
        if app['created_by'] != user['username']:
            return jsonify({'error': '只有单据创建人可以上传申请证据'}), 403
        if app['status'] == 'CORRECTION_REQUIRED' and app['current_handler'] != user['username']:
            return jsonify({'error': '当前处理人不是您，无法上传'}), 403

    if node in ['VERIFICATION', 'APPROVAL']:
        if app['current_handler'] and app['current_handler'] != user['username']:
            return jsonify({'error': f'当前处理人为 {app["current_handler"]}，您无权上传'}), 403

    if attach_type and attach_type not in rules['allowed_types']:
        node_label = NODES.get(node, node)
        type_label = ATTACHMENT_NAMES.get(attach_type, attach_type)
        return jsonify({
            'error': f'{type_label}不属于{node_label}节点的证据类型'
        }), 400

    cursor = db.execute(
        '''INSERT INTO attachments
           (loan_application_id, attach_type, attach_name, is_required, node, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (app_id, attach_type, data.get('attach_name', ''),
         data.get('is_required', 0), node, user['username'])
    )
    db.commit()

    return jsonify({'id': cursor.lastrowid})


@app.route('/api/applications/<int:app_id>/audit-notes', methods=['POST'])
def add_audit_note(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}
    db = get_db()

    app = db.execute("SELECT * FROM loan_applications WHERE id = ?", (app_id,)).fetchone()
    if not app:
        return jsonify({'error': '申请单不存在'}), 404

    cursor = db.execute(
        '''INSERT INTO audit_notes (loan_application_id, note, created_by)
           VALUES (?, ?, ?)''',
        (app_id, data.get('note', ''), user['username'])
    )
    db.commit()

    return jsonify({'id': cursor.lastrowid})


@app.route('/api/applications/<int:app_id>/records', methods=['GET'])
def list_records(app_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    db = get_db()
    rows = db.execute(
        "SELECT * FROM processing_records WHERE loan_application_id = ? ORDER BY created_at DESC",
        (app_id,)
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/meta', methods=['GET'])
def get_meta():
    return jsonify({
        'roles': ROLES,
        'statuses': STATUSES,
        'nodes': NODES,
        'attachmentNames': ATTACHMENT_NAMES,
        'requiredAttachments': REQUIRED_ATTACHMENTS
    })


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    if not os.path.exists(os.path.join(os.path.dirname(__file__), 'loan_system.db')):
        init_db()
    app.run(host='0.0.0.0', port=BACKEND_PORT, debug=True)
