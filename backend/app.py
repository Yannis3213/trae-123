from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from pydantic import BaseModel

from database import (
    get_conn, init_db, ROLES, STAGES, STATUS_FLOW
)

PORT = 8001
FRONTEND_PORT = 3001

USER_MAP = {
    'zhangsan': {'role': 'register', 'name': '张三（行政专员）'},
    'lisi': {'role': 'audit', 'name': '李四（后勤主管）'},
    'wangwu': {'role': 'review', 'name': '王五（行政经理）'}
}

STAGE_REQUIRED_EVIDENCE = {
    'room_booking': 'room_booking_evidence',
    'equipment_prep': 'equipment_evidence',
    'usage_confirm': 'usage_evidence'
}

STAGE_LABEL_MAP = {
    'room_booking_evidence': '会议室预约证据',
    'equipment_evidence': '设备准备证据',
    'usage_evidence': '使用确认证据'
}

STAGE_TRANSITION = {
    'room_booking': 'equipment_prep',
    'equipment_prep': 'usage_confirm',
    'usage_confirm': None
}

ROLE_BY_STAGE = {
    'room_booking': 'audit',
    'equipment_prep': 'audit',
    'usage_confirm': 'audit'
}

class ProcessRequest(BaseModel):
    order_ids: List[int]
    action: str
    opinion: Optional[str] = None
    audit_remark: Optional[str] = None
    exception_reason: Optional[str] = None
    version: Optional[int] = None
    evidence: Optional[Dict[str, str]] = None

def check_overdue(deadline_str: str) -> Dict[str, Any]:
    deadline = datetime.strptime(deadline_str, '%Y-%m-%d %H:%M:%S')
    now = datetime.now()
    diff = deadline - now
    
    if diff.total_seconds() < 0:
        return {'level': 'overdue', 'label': '逾期', 'hours': diff.total_seconds() / 3600}
    elif diff.total_seconds() < 24 * 3600:
        return {'level': 'urgent', 'label': '临期', 'hours': diff.total_seconds() / 3600}
    else:
        return {'level': 'normal', 'label': '正常', 'hours': diff.total_seconds() / 3600}

def get_current_user(request: Request) -> Dict[str, Any]:
    user_header = request.headers.get('X-Current-User')
    if not user_header or user_header not in USER_MAP:
        return None
    user_info = USER_MAP[user_header]
    return {'id': user_header, **user_info}

def require_permission(allowed_roles: List[str]):
    def decorator(func):
        async def wrapper(request: Request):
            user = get_current_user(request)
            if not user:
                return JSONResponse({'error': '未登录或用户不存在', 'code': 'NO_AUTH'}, status_code=401)
            if user['role'] not in allowed_roles:
                return JSONResponse({
                    'error': f"越权操作：{ROLES.get(user['role'], user['role'])} 无此操作权限",
                    'code': 'PERMISSION_DENIED',
                    'current_role': user['role'],
                    'allowed_roles': allowed_roles
                }, status_code=403)
            return await func(request, user)
        return wrapper
    return decorator

def validate_order_access(order: Dict[str, Any], user: Dict[str, Any], action: str) -> Optional[Dict[str, Any]]:
    if order['current_role'] != user['role']:
        return {
            'error': f"越权操作：当前处理角色应为 {ROLES.get(order['current_role'])}，您是 {ROLES.get(user['role'])}",
            'code': 'WRONG_ROLE',
            'expected_role': order['current_role']
        }
    
    if order['handler'] and order['handler'] != user['id']:
        return {
            'error': f"越权操作：该单据处理人为 {order['handler']}，您不是指定处理人",
            'code': 'WRONG_HANDLER',
            'expected_handler': order['handler']
        }
    
    return None

def validate_version(order: Dict[str, Any], expected_version: int) -> Optional[Dict[str, Any]]:
    if order['version'] != expected_version:
        return {
            'error': f"版本冲突：当前版本为 v{order['version']}，您提交的是 v{expected_version}，请刷新后重试",
            'code': 'VERSION_CONFLICT',
            'current_version': order['version'],
            'submitted_version': expected_version
        }
    return None

def validate_status_transition(order: Dict[str, Any], action: str) -> Optional[Dict[str, Any]]:
    current_status = order['status']
    
    valid_transitions = {
        'pending_sign': ['approve', 'return', 'exception'],
        'exception_return': ['resubmit', 'return'],
        'sign_complete': ['review'],
        'reviewed': []
    }
    
    if action not in valid_transitions.get(current_status, []):
        return {
            'error': f"状态冲突：当前状态为 [{STATUS_FLOW[current_status]}]，不允许执行 [{_action_label(action)}] 操作",
            'code': 'STATUS_CONFLICT',
            'current_status': current_status,
            'action': action,
            'allowed_actions': valid_transitions.get(current_status, [])
        }
    return None

def _action_label(action: str) -> str:
    labels = {
        'approve': '审核通过',
        'return': '退回补正',
        'exception': '异常回传',
        'resubmit': '补正提交',
        'review': '复核归档',
        'create': '创建',
        'update_evidence': '更新证据'
    }
    return labels.get(action, action)

def validate_evidence(order: Dict[str, Any], action: str, evidence: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
    if action == 'approve':
        stage = order['current_stage']
        evidence_field = STAGE_REQUIRED_EVIDENCE[stage]
        existing_evidence = order.get(evidence_field, '')
        new_evidence = (evidence or {}).get(evidence_field, '')
        final_evidence = new_evidence or existing_evidence
        
        if not final_evidence:
            return {
                'error': f"缺证据：{STAGES[stage]} 环节必须上传{STAGE_LABEL_MAP[evidence_field]}",
                'code': 'MISSING_EVIDENCE',
                'stage': stage,
                'evidence_field': evidence_field,
                'evidence_label': STAGE_LABEL_MAP[evidence_field]
            }
    
    if action == 'resubmit':
        if not evidence or len(evidence) == 0:
            return {
                'error': '补正提交必须提供补正材料',
                'code': 'MISSING_CORRECTION',
                'expected': '至少补充一项证据材料'
            }
        
        valid_fields = set(STAGE_REQUIRED_EVIDENCE.values())
        invalid_fields = [f for f in evidence.keys() if f not in valid_fields]
        if invalid_fields:
            return {
                'error': f"无效补正字段：{', '.join(invalid_fields)}，仅支持：{', '.join(valid_fields)}",
                'code': 'INVALID_EVIDENCE_FIELD',
                'invalid_fields': invalid_fields,
                'valid_fields': list(valid_fields)
            }
        
        empty_fields = [k for k, v in evidence.items() if not v or not v.strip()]
        if empty_fields:
            return {
                'error': f"补正证据值不能为空：{', '.join(empty_fields)}，请填写有效内容",
                'code': 'EMPTY_EVIDENCE_VALUE',
                'empty_fields': empty_fields
            }
    
    if action == 'review':
        all_stages_evidence = [
            ('room_booking', order.get('room_booking_evidence', '')),
            ('equipment_prep', order.get('equipment_evidence', '')),
            ('usage_confirm', order.get('usage_evidence', ''))
        ]
        missing_stages = [STAGES[stage] for stage, ev in all_stages_evidence if not ev or not ev.strip()]
        if missing_stages:
            return {
                'error': f"复核归档要求三阶段证据齐全，缺少：{'、'.join(missing_stages)}",
                'code': 'INCOMPLETE_EVIDENCE_FOR_REVIEW',
                'missing_stages': missing_stages
            }
    
    return None

def validate_overdue(order: Dict[str, Any], action: str, audit_remark: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if action not in ['approve', 'resubmit', 'review']:
        return None
    
    deadline = datetime.strptime(order['deadline'], '%Y-%m-%d %H:%M:%S')
    if deadline < datetime.now():
        if not audit_remark:
            return {
                'error': '该单据已逾期，必须填写审计备注才能继续处理',
                'code': 'OVERDUE_REQUIRES_REMARK',
                'deadline': order['deadline'],
                'overdue_hours': abs((datetime.now() - deadline).total_seconds() / 3600)
            }
    
    return None

def validate_batch_request(data: Dict[str, Any], user: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not data.get('order_ids'):
        return {'error': '请选择要处理的单据', 'code': 'NO_ORDER_SELECTED'}
    if not data.get('action'):
        return {'error': '请指定操作类型', 'code': 'NO_ACTION'}
    
    action = data['action']
    
    if action in ['return', 'exception'] and not data.get('exception_reason'):
        return {'error': '退回/异常回传必须填写异常原因', 'code': 'MISSING_EXCEPTION_REASON'}
    
    if action in ['approve', 'review'] and not data.get('opinion'):
        return {'error': '请填写处理意见', 'code': 'MISSING_OPINION'}
    
    return None

def validate_single_order_full(order: Dict[str, Any], user: Dict[str, Any], action: str,
                               version: Optional[int] = None,
                               evidence: Optional[Dict[str, str]] = None,
                               audit_remark: Optional[str] = None,
                               exception_reason: Optional[str] = None) -> Optional[Dict[str, Any]]:
    check_order = dict(order)
    
    access_error = validate_order_access(check_order, user, action)
    if access_error:
        return access_error
    
    if version is not None:
        version_error = validate_version(check_order, version)
        if version_error:
            return version_error
    
    status_error = validate_status_transition(check_order, action)
    if status_error:
        return status_error
    
    overdue_error = validate_overdue(check_order, action, audit_remark)
    if overdue_error:
        return overdue_error
    
    if action in ['return', 'exception'] and not exception_reason:
        return {
            'error': '退回/异常回传必须填写异常原因',
            'code': 'MISSING_EXCEPTION_REASON'
        }
    
    if action == 'approve':
        evidence_error = validate_evidence(check_order, action, evidence)
        if evidence_error:
            return evidence_error
    
    if action == 'resubmit':
        evidence_error = validate_evidence(check_order, action, evidence)
        if evidence_error:
            return evidence_error
    
    if action == 'review':
        evidence_error = validate_evidence(check_order, action, None)
        if evidence_error:
            return evidence_error
    
    return None

def record_process(conn, order_id: int, order_version: int, action: str, 
                   from_status: str, to_status: str, from_stage: str, to_stage: str,
                   from_role: str, to_role: str,
                   user: Dict[str, Any], opinion: Optional[str], 
                   audit_remark: Optional[str], exception_reason: Optional[str],
                   is_exception: bool = False):
    c = conn.cursor()
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    c.execute('''INSERT INTO process_records 
        (order_id, order_version, action, from_status, to_status, from_stage, to_stage,
         from_role, to_role, handler, handler_role, opinion, audit_remark, exception_reason, is_exception, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (order_id, order_version, action, from_status, to_status, from_stage, to_stage,
         from_role, to_role, user['id'], user['role'], opinion, audit_remark, exception_reason, is_exception, now))
    
    if audit_remark:
        c.execute('''INSERT INTO audit_remarks (order_id, remark, created_by, created_at)
            VALUES (?, ?, ?, ?)''', (order_id, audit_remark, user['id'], now))
    
    if is_exception and exception_reason:
        c.execute('''INSERT INTO exception_reasons (order_id, stage, reason, reported_by, created_at)
            VALUES (?, ?, ?, ?, ?)''', (order_id, from_stage, exception_reason, user['id'], now))

def apply_evidence_to_order(order: Dict[str, Any], evidence: Optional[Dict[str, str]]) -> Dict[str, Any]:
    result = dict(order)
    if evidence:
        for field, value in evidence.items():
            if field in STAGE_REQUIRED_EVIDENCE.values():
                result[field] = value
    return result

def update_order_status(conn, order_id: int, action: str, user: Dict[str, Any], 
                        evidence: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    c = conn.cursor()
    c.execute('SELECT * FROM meeting_orders WHERE id = ?', (order_id,))
    order = dict(c.fetchone())
    
    order_with_evidence = apply_evidence_to_order(order, evidence)
    
    old_status = order['status']
    old_stage = order['current_stage']
    old_role = order['current_role']
    new_status = old_status
    new_stage = old_stage
    new_role = old_role
    new_handler = order['handler']
    
    if action == 'approve':
        next_stage = STAGE_TRANSITION[order['current_stage']]
        if next_stage:
            new_stage = next_stage
            new_role = ROLE_BY_STAGE.get(next_stage, 'audit')
            new_handler = _get_next_handler(new_role, user['id'])
            new_status = 'pending_sign'
        else:
            new_status = 'sign_complete'
            new_role = 'review'
            new_handler = _get_next_handler('review', user['id'])
    
    elif action == 'return':
        new_status = 'exception_return'
        new_role = 'register'
        new_handler = order['created_by']
    
    elif action == 'exception':
        new_status = 'exception_return'
        new_role = 'register'
        new_handler = order['created_by']
    
    elif action == 'resubmit':
        new_status = 'pending_sign'
        new_role = 'audit'
        new_handler = _get_next_handler('audit', user['id'])
    
    elif action == 'review':
        new_status = 'reviewed'
        new_role = 'review'
        new_handler = order['handler']
    
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    new_version = order['version'] + 1
    
    update_fields = [
        'status = ?', 'current_stage = ?', 'current_role = ?', 'handler = ?',
        'version = ?', 'updated_at = ?'
    ]
    update_values = [new_status, new_stage, new_role, new_handler, new_version, now]
    
    if evidence:
        for stage_field, evidence_value in evidence.items():
            if stage_field in STAGE_REQUIRED_EVIDENCE.values():
                update_fields.append(f'{stage_field} = ?')
                update_values.append(evidence_value)
    
    update_values.append(order_id)
    
    c.execute(f'''UPDATE meeting_orders SET {', '.join(update_fields)} WHERE id = ?''', update_values)
    
    return {
        'order_id': order_id,
        'old_status': old_status,
        'new_status': new_status,
        'old_stage': old_stage,
        'new_stage': new_stage,
        'old_role': old_role,
        'new_role': new_role,
        'new_version': new_version,
        'new_handler': new_handler
    }

def _get_next_handler(role: str, current_user: str) -> str:
    for user_id, info in USER_MAP.items():
        if info['role'] == role and user_id != current_user:
            return user_id
    for user_id, info in USER_MAP.items():
        if info['role'] == role:
            return user_id
    return current_user

def row_to_dict(row) -> Dict[str, Any]:
    if row is None:
        return None
    d = dict(row)
    if 'deadline' in d and d['deadline']:
        d['overdue_info'] = check_overdue(d['deadline'])
    if 'status' in d and d['status'] in STATUS_FLOW:
        d['status_label'] = STATUS_FLOW[d['status']]
    if 'current_stage' in d and d['current_stage'] in STAGES:
        d['stage_label'] = STAGES[d['current_stage']]
    if 'current_role' in d and d['current_role'] in ROLES:
        d['role_label'] = ROLES[d['current_role']]
    if 'handler' in d and d['handler'] in USER_MAP:
        d['handler_name'] = USER_MAP[d['handler']]['name']
    if 'created_by' in d and d['created_by'] in USER_MAP:
        d['created_by_name'] = USER_MAP[d['created_by']]['name']
    return d

async def list_orders(request: Request, user: Dict[str, Any]):
    params = request.query_params
    status = params.get('status')
    stage = params.get('stage')
    keyword = params.get('keyword')
    overdue_level = params.get('overdue_level')
    mine_only = params.get('mine_only', '1')
    
    with get_conn() as conn:
        c = conn.cursor()
        
        where_clauses = []
        where_values = []
        
        if mine_only == '1':
            where_clauses.append('current_role = ?')
            where_values.append(user['role'])
            where_clauses.append('(handler IS NULL OR handler = ?)')
            where_values.append(user['id'])
        
        if status:
            where_clauses.append('status = ?')
            where_values.append(status)
        if stage:
            where_clauses.append('current_stage = ?')
            where_values.append(stage)
        if keyword:
            where_clauses.append('(title LIKE ? OR order_no LIKE ?)')
            where_values.extend([f'%{keyword}%', f'%{keyword}%'])
        
        sql = f'''SELECT * FROM meeting_orders 
                  {('WHERE ' + ' AND '.join(where_clauses)) if where_clauses else ''}
                  ORDER BY 
                    CASE status 
                      WHEN 'exception_return' THEN 0 
                      WHEN 'pending_sign' THEN 1 
                      WHEN 'sign_complete' THEN 2
                      WHEN 'reviewed' THEN 3
                      ELSE 4 
                    END,
                    deadline ASC,
                    created_at DESC'''
        c.execute(sql, where_values)
        orders = [row_to_dict(row) for row in c.fetchall()]
        
        if overdue_level:
            orders = [o for o in orders if o.get('overdue_info', {}).get('level') == overdue_level]
        
        role_where = ['current_role = ?']
        role_values = [user['role']]
        c.execute(f'''SELECT status, COUNT(*) as cnt FROM meeting_orders 
                     WHERE {' AND '.join(role_where)} GROUP BY status''', role_values)
        status_stats = {row['status']: row['cnt'] for row in c.fetchall()}
        
        total = len(orders)
        overdue_count = sum(1 for o in orders if o.get('overdue_info', {}).get('level') == 'overdue')
        urgent_count = sum(1 for o in orders if o.get('overdue_info', {}).get('level') == 'urgent')
        
        return JSONResponse({
            'orders': orders,
            'stats': {
                'total': total,
                'pending_sign': status_stats.get('pending_sign', 0),
                'exception_return': status_stats.get('exception_return', 0),
                'sign_complete': status_stats.get('sign_complete', 0),
                'reviewed': status_stats.get('reviewed', 0),
                'overdue': overdue_count,
                'urgent': urgent_count
            },
            'current_user': user
        })

async def get_order_detail(request: Request, user: Dict[str, Any]):
    order_id = int(request.path_params['id'])
    
    with get_conn() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM meeting_orders WHERE id = ?', (order_id,))
        order = row_to_dict(c.fetchone())
        
        if not order:
            return JSONResponse({'error': '单据不存在', 'code': 'NOT_FOUND'}, status_code=404)
        
        c.execute('''SELECT pr.* 
                     FROM process_records pr
                     WHERE pr.order_id = ? ORDER BY pr.created_at DESC''', (order_id,))
        records = [dict(row) for row in c.fetchall()]
        for r in records:
            if r['handler_role'] in ROLES:
                r['role_label'] = ROLES[r['handler_role']]
            if r.get('from_role') and r['from_role'] in ROLES:
                r['from_role_label'] = ROLES[r['from_role']]
            if r.get('to_role') and r['to_role'] in ROLES:
                r['to_role_label'] = ROLES[r['to_role']]
            if r['handler'] in USER_MAP:
                r['handler_name'] = USER_MAP[r['handler']]['name']
            r['action_label'] = _action_label(r['action'])
        
        c.execute('''SELECT * FROM attachments WHERE order_id = ? ORDER BY uploaded_at DESC''', (order_id,))
        attachments = [dict(row) for row in c.fetchall()]
        
        c.execute('''SELECT ar.* 
                     FROM audit_remarks ar
                     WHERE ar.order_id = ? ORDER BY ar.created_at DESC''', (order_id,))
        remarks = [dict(row) for row in c.fetchall()]
        for r in remarks:
            if r['created_by'] in USER_MAP:
                r['creator_name'] = USER_MAP[r['created_by']]['name']
        
        c.execute('''SELECT er.* 
                     FROM exception_reasons er
                     WHERE er.order_id = ? ORDER BY er.created_at DESC''', (order_id,))
        exceptions = [dict(row) for row in c.fetchall()]
        for e in exceptions:
            if e['stage'] in STAGES:
                e['stage_label'] = STAGES[e['stage']]
            if e['reported_by'] in USER_MAP:
                e['reporter_name'] = USER_MAP[e['reported_by']]['name']
        
        can_operate = (order['current_role'] == user['role'] and 
                       (not order['handler'] or order['handler'] == user['id']))
        
        can_edit_evidence = can_operate and order['status'] not in ['sign_complete', 'reviewed']
        
        allowed_actions = []
        if can_operate:
            if order['status'] == 'pending_sign':
                allowed_actions = ['approve', 'exception']
            elif order['status'] == 'exception_return' and user['role'] == 'register':
                allowed_actions = ['resubmit', 'return']
            elif order['status'] == 'exception_return' and user['role'] in ['audit', 'review']:
                allowed_actions = ['return']
            elif order['status'] == 'sign_complete' and user['role'] == 'review':
                allowed_actions = ['review']
        
        return JSONResponse({
            'order': order,
            'records': records,
            'attachments': attachments,
            'remarks': remarks,
            'exceptions': exceptions,
            'can_operate': can_operate,
            'can_edit_evidence': can_edit_evidence,
            'required_evidence': STAGE_REQUIRED_EVIDENCE.get(order['current_stage']),
            'allowed_actions': allowed_actions,
            'evidence_fields': STAGE_REQUIRED_EVIDENCE,
            'evidence_labels': STAGE_LABEL_MAP
        })

async def batch_process(request: Request, user: Dict[str, Any]):
    body = await request.json()
    
    validation_error = validate_batch_request(body, user)
    if validation_error:
        return JSONResponse(validation_error, status_code=400)
    
    order_ids = body['order_ids']
    action = body['action']
    opinion = body.get('opinion')
    audit_remark = body.get('audit_remark')
    exception_reason = body.get('exception_reason')
    version = body.get('version')
    evidence = body.get('evidence') or {}
    
    results = []
    
    with get_conn() as conn:
        for order_id in order_ids:
            c = conn.cursor()
            c.execute('SELECT * FROM meeting_orders WHERE id = ?', (order_id,))
            row = c.fetchone()
            
            if not row:
                results.append({
                    'order_id': order_id,
                    'success': False,
                    'error': '单据不存在',
                    'code': 'NOT_FOUND'
                })
                continue
            
            order = dict(row)
            
            check_result = validate_single_order_full(
                order, user, action, version, evidence, audit_remark, exception_reason
            )
            if check_result:
                results.append({
                    'order_id': order_id,
                    'order_no': order['order_no'],
                    'success': False,
                    **check_result
                })
                continue
            
            is_exception = action in ['return', 'exception']
            
            try:
                update_result = update_order_status(conn, order_id, action, user, evidence)
                
                record_process(
                    conn, order_id, order['version'], action,
                    order['status'], update_result['new_status'],
                    order['current_stage'], update_result['new_stage'],
                    order['current_role'], update_result['new_role'],
                    user, opinion, audit_remark, exception_reason,
                    is_exception
                )
                
                conn.commit()
                
                record_data = {
                    'action': action,
                    'action_label': _action_label(action),
                    'from_status': order['status'],
                    'from_status_label': STATUS_FLOW[order['status']],
                    'to_status': update_result['new_status'],
                    'to_status_label': STATUS_FLOW[update_result['new_status']],
                    'from_stage': order['current_stage'],
                    'from_stage_label': STAGES[order['current_stage']],
                    'to_stage': update_result['new_stage'],
                    'to_stage_label': STAGES[update_result['new_stage']],
                    'from_role': order['current_role'],
                    'from_role_label': ROLES[order['current_role']],
                    'to_role': update_result['new_role'],
                    'to_role_label': ROLES[update_result['new_role']],
                    'handler': user['id'],
                    'handler_name': user['name'],
                    'handler_role': user['role'],
                    'handler_role_label': ROLES[user['role']],
                    'opinion': opinion,
                    'audit_remark': audit_remark,
                    'exception_reason': exception_reason,
                    'is_exception': is_exception,
                    'version_before': order['version'],
                    'version_after': update_result['new_version']
                }
                
                result_item = {
                    'order_id': order_id,
                    'order_no': order['order_no'],
                    'success': True,
                    'message': f"处理成功：{STATUS_FLOW[order['status']]} → {STATUS_FLOW[update_result['new_status']]}",
                    'record': record_data,
                    **update_result
                }
                
                if audit_remark:
                    result_item['audit_remark'] = audit_remark
                
                if is_exception and exception_reason:
                    result_item['exception_reason'] = exception_reason
                
                results.append(result_item)
            except Exception as e:
                conn.rollback()
                results.append({
                    'order_id': order_id,
                    'order_no': order['order_no'],
                    'success': False,
                    'error': f'系统错误：{str(e)}',
                    'code': 'SYSTEM_ERROR'
                })
    
    success_count = sum(1 for r in results if r['success'])
    fail_count = len(results) - success_count
    
    return JSONResponse({
        'success': fail_count == 0,
        'success_count': success_count,
        'fail_count': fail_count,
        'results': results,
        'message': f"批量处理完成：成功 {success_count} 条，失败 {fail_count} 条"
    })

async def create_order(request: Request, user: Dict[str, Any]):
    body = await request.json()
    
    required_fields = ['title', 'meeting_date', 'start_time', 'end_time', 'deadline']
    for field in required_fields:
        if not body.get(field):
            return JSONResponse({
                'error': f'缺少必填字段：{field}',
                'code': 'MISSING_FIELD',
                'field': field
            }, status_code=400)
    
    with get_conn() as conn:
        c = conn.cursor()
        now = datetime.now()
        order_no = f'MEET-{now.strftime("%Y%m")}-{now.strftime("%d%H%M%S")}'
        created_at = now.strftime('%Y-%m-%d %H:%M:%S')
        
        evidence = body.get('evidence') or {}
        
        c.execute('''INSERT INTO meeting_orders 
            (order_no, title, meeting_date, start_time, end_time, room_name, 
             attendees, content, status, current_stage, current_role, handler,
             deadline, version, created_at, updated_at, created_by,
             room_booking_evidence, equipment_evidence, usage_evidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (order_no, body['title'], body['meeting_date'], body['start_time'],
             body['end_time'], body.get('room_name'), body.get('attendees'),
             body.get('content'), 'pending_sign', 'room_booking', 'audit',
             _get_next_handler('audit', user['id']), body['deadline'], 1,
             created_at, created_at, user['id'],
             evidence.get('room_booking_evidence', ''),
             evidence.get('equipment_evidence', ''),
             evidence.get('usage_evidence', '')))
        
        conn.commit()
        
        order_id = c.lastrowid
        
        record_process(
            conn, order_id, 1, 'create', None, 'pending_sign',
            None, 'room_booking', None, 'audit',
            user, '创建会议预约单', None, None, False
        )
        
        conn.commit()
        
        return JSONResponse({
            'success': True,
            'order_id': order_id,
            'order_no': order_no,
            'message': '创建成功，已流转至审核主管待签收'
        })

async def resubmit_order(request: Request, user: Dict[str, Any]):
    order_id = int(request.path_params['id'])
    body = await request.json()
    
    with get_conn() as conn:
        c = conn.cursor()
        c.execute('SELECT * FROM meeting_orders WHERE id = ?', (order_id,))
        row = c.fetchone()
        
        if not row:
            return JSONResponse({'error': '单据不存在', 'code': 'NOT_FOUND'}, status_code=404)
        
        order = dict(row)
        
        check_result = validate_single_order_full(
            order, user, 'resubmit',
            body.get('version'),
            body.get('evidence'),
            body.get('audit_remark'),
            None
        )
        if check_result:
            return JSONResponse(check_result, status_code=400)
        
        try:
            evidence = body.get('evidence') or {}
            opinion = body.get('opinion') or '补正后重新提交'
            audit_remark = body.get('audit_remark')
            
            update_result = update_order_status(conn, order_id, 'resubmit', user, evidence)
            
            record_process(
                conn, order_id, order['version'], 'resubmit',
                order['status'], update_result['new_status'],
                order['current_stage'], update_result['new_stage'],
                order['current_role'], update_result['new_role'],
                user, opinion, audit_remark, None, False
            )
            
            conn.commit()
            
            return JSONResponse({
                'success': True,
                'order_id': order_id,
                'message': '补正提交成功，已流转至审核主管待签收',
                **update_result
            })
        except Exception as e:
            conn.rollback()
            return JSONResponse({
                'error': f'系统错误：{str(e)}',
                'code': 'SYSTEM_ERROR'
            }, status_code=500)

async def get_current_user_info(request: Request):
    user = get_current_user(request)
    if not user:
        return JSONResponse({
            'user': None,
            'users': [{'id': k, **v} for k, v in USER_MAP.items()],
            'roles': ROLES,
            'stages': STAGES,
            'statuses': STATUS_FLOW,
            'evidence_fields': STAGE_REQUIRED_EVIDENCE,
            'evidence_labels': STAGE_LABEL_MAP
        })
    return JSONResponse({
        'user': user,
        'users': [{'id': k, **v} for k, v in USER_MAP.items()],
        'roles': ROLES,
        'stages': STAGES,
        'statuses': STATUS_FLOW,
        'evidence_fields': STAGE_REQUIRED_EVIDENCE,
        'evidence_labels': STAGE_LABEL_MAP
    })

async def statistics(request: Request, user: Dict[str, Any]):
    with get_conn() as conn:
        c = conn.cursor()
        
        c.execute('''SELECT status, current_role, COUNT(*) as cnt 
                     FROM meeting_orders GROUP BY status, current_role''')
        rows = c.fetchall()
        
        role_stats = {}
        for role in ROLES:
            role_stats[role] = {'total': 0, 'pending_sign': 0, 'exception_return': 0, 'sign_complete': 0, 'reviewed': 0}
        
        for row in rows:
            r = dict(row)
            if r['current_role'] in role_stats:
                role_stats[r['current_role']]['total'] += r['cnt']
                if r['status'] in role_stats[r['current_role']]:
                    role_stats[r['current_role']][r['status']] = r['cnt']
        
        c.execute('''SELECT * FROM meeting_orders WHERE deadline < ? ORDER BY deadline ASC''',
                  (datetime.now().strftime('%Y-%m-%d %H:%M:%S'),))
        overdue_orders = [row_to_dict(row) for row in c.fetchall()]
        
        return JSONResponse({
            'role_stats': role_stats,
            'overdue_orders': overdue_orders,
            'overdue_count': len(overdue_orders)
        })

routes = [
    Route('/api/user', get_current_user_info, methods=['GET']),
    Route('/api/orders', require_permission(['register', 'audit', 'review'])(list_orders), methods=['GET']),
    Route('/api/orders/{id:int}', require_permission(['register', 'audit', 'review'])(get_order_detail), methods=['GET']),
    Route('/api/orders', require_permission(['register'])(create_order), methods=['POST']),
    Route('/api/orders/{id:int}/resubmit', require_permission(['register'])(resubmit_order), methods=['POST']),
    Route('/api/orders/batch', require_permission(['register', 'audit', 'review'])(batch_process), methods=['POST']),
    Route('/api/statistics', require_permission(['register', 'audit', 'review'])(statistics), methods=['GET']),
]

app = Starlette(routes=routes)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f'http://localhost:{FRONTEND_PORT}', f'http://127.0.0.1:{FRONTEND_PORT}'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.on_event('startup')
async def startup():
    init_db()

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=PORT)
