import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from database import get_db, init_db


def seed_data():
    db = get_db()
    c = db.cursor()

    c.execute("DELETE FROM audit_notes")
    c.execute("DELETE FROM exception_reasons")
    c.execute("DELETE FROM processing_records")
    c.execute("DELETE FROM attachments")
    c.execute("DELETE FROM loan_applications")
    c.execute("DELETE FROM users")

    users = [
        ('credit_officer_01', '123456', '张信贷', 'CREDIT_OFFICER'),
        ('credit_officer_02', '123456', '李信贷', 'CREDIT_OFFICER'),
        ('risk_auditor_01', '123456', '王风控', 'RISK_AUDITOR'),
        ('risk_auditor_02', '123456', '赵风控', 'RISK_AUDITOR'),
        ('supervisor_01', '123456', '陈主管', 'LOAN_SUPERVISOR'),
    ]
    c.executemany(
        "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)",
        users
    )

    now = datetime.now()

    applications = [
        {
            'no': 'LA' + (now - timedelta(days=5)).strftime('%Y%m%d') + '0001',
            'name': '刘正常',
            'id_card': '110101199001011234',
            'phone': '13800000001',
            'amount': 50000,
            'purpose': '个人消费',
            'term': 12,
            'status': 'VERIFICATION_PASSED',
            'node': 'APPROVAL',
            'handler': 'supervisor_01',
            'created_by': 'credit_officer_01',
            'created_at': (now - timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now + timedelta(days=2)).strftime('%Y-%m-%d'),
            'due': (now + timedelta(days=25)).strftime('%Y-%m-%d'),
            'remark': '正常流转案例：申请单已完成核验，待贷后主管审批',
            'attachments': [
                ('ID_CARD', '身份证正反面', 1, 'APPLICATION', 'credit_officer_01'),
                ('INCOME_PROOF', '收入证明', 1, 'APPLICATION', 'credit_officer_01'),
                ('CREDIT_REPORT', '个人征信报告', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('VERIFICATION_RECORD', '核验记录表', 1, 'VERIFICATION', 'risk_auditor_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_01', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_01', 'CREDIT_OFFICER', 'VERIFICATION', '提交申请，资料齐全'),
                ('VERIFY_PASS', 'PENDING_VERIFICATION', 'VERIFICATION_PASSED', 'risk_auditor_01', 'RISK_AUDITOR', 'APPROVAL', '核验通过，征信良好'),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=3)).strftime('%Y%m%d') + '0002',
            'name': '钱待核',
            'id_card': '110101199102022345',
            'phone': '13800000002',
            'amount': 80000,
            'purpose': '装修贷款',
            'term': 24,
            'status': 'PENDING_VERIFICATION',
            'node': 'VERIFICATION',
            'handler': 'risk_auditor_01',
            'created_by': 'credit_officer_01',
            'created_at': (now - timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now + timedelta(days=4)).strftime('%Y-%m-%d'),
            'due': (now + timedelta(days=27)).strftime('%Y-%m-%d'),
            'remark': '待核验案例：风控审核中，资料齐全，可正常核验通过',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_01'),
                ('INCOME_PROOF', '工资流水', 1, 'APPLICATION', 'credit_officer_01'),
                ('CREDIT_REPORT', '征信报告', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('VERIFICATION_RECORD', '核验记录表', 1, 'VERIFICATION', 'risk_auditor_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_01', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_01', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验'),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=4)).strftime('%Y%m%d') + '0003',
            'name': '孙缺料',
            'id_card': '110101199203033456',
            'phone': '13800000003',
            'amount': 30000,
            'purpose': '教育培训',
            'term': 12,
            'status': 'PENDING_VERIFICATION',
            'node': 'VERIFICATION',
            'handler': 'risk_auditor_01',
            'created_by': 'credit_officer_02',
            'created_at': (now - timedelta(days=4)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now + timedelta(days=3)).strftime('%Y-%m-%d'),
            'due': (now + timedelta(days=26)).strftime('%Y-%m-%d'),
            'remark': '缺材料案例：核验阶段缺少征信报告和核验记录，批量核验时应被拦截',
            'attachments': [
                ('ID_CARD', '身份证照片', 1, 'APPLICATION', 'credit_officer_02'),
                ('INCOME_PROOF', '收入证明', 1, 'APPLICATION', 'credit_officer_02'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_02', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_02', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验申请'),
            ],
            'exceptions': [
                ('MISSING_EVIDENCE', '核验证据不全', '缺少征信报告和核验记录，待风控补充或退回', 'risk_auditor_01', (now - timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S')),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=15)).strftime('%Y%m%d') + '0004',
            'name': '周超时',
            'id_card': '110101199304044567',
            'phone': '13800000004',
            'amount': 100000,
            'purpose': '经营周转',
            'term': 6,
            'status': 'PENDING_VERIFICATION',
            'node': 'VERIFICATION',
            'handler': 'risk_auditor_01',
            'created_by': 'credit_officer_01',
            'created_at': (now - timedelta(days=15)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now - timedelta(days=8)).strftime('%Y-%m-%d'),
            'due': (now - timedelta(days=5)).strftime('%Y-%m-%d'),
            'remark': '超时逾期案例：核验时限已过期8天，不允许通过，只能退回补正',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_01'),
                ('INCOME_PROOF', '营业执照', 1, 'APPLICATION', 'credit_officer_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_01', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_01', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验，因工作量大被搁置'),
            ],
            'exceptions': [
                ('TIMEOUT', '核验超时', f'核验时限 {(now - timedelta(days=8)).strftime("%Y-%m-%d")}，已逾期8天', 'risk_auditor_01', (now - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=6)).strftime('%Y%m%d') + '0005',
            'name': '吴补正',
            'id_card': '110101199405055678',
            'phone': '13800000005',
            'amount': 60000,
            'purpose': '购车首付',
            'term': 36,
            'status': 'CORRECTION_REQUIRED',
            'node': 'APPLICATION',
            'handler': 'credit_officer_01',
            'created_by': 'credit_officer_01',
            'created_at': (now - timedelta(days=6)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now + timedelta(days=1)).strftime('%Y-%m-%d'),
            'due': (now + timedelta(days=24)).strftime('%Y-%m-%d'),
            'remark': '退回补正案例：风控核验时发现材料有误，已退回信贷员补正',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_01'),
                ('INCOME_PROOF', '收入证明(待补正)', 0, 'APPLICATION', 'credit_officer_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_01', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_01', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验'),
                ('RETURN_CORRECTION', 'PENDING_VERIFICATION', 'CORRECTION_REQUIRED', 'risk_auditor_01', 'RISK_AUDITOR', 'APPLICATION', '收入证明金额与银行流水不符，退回补正'),
            ],
            'exceptions': [
                ('RETURNED', '退回补正', '收入证明金额与银行流水不符，请核实后重新提交', 'risk_auditor_01', (now - timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S')),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=10)).strftime('%Y%m%d') + '0006',
            'name': '郑失败',
            'id_card': '110101199506066789',
            'phone': '13800000006',
            'amount': 45000,
            'purpose': '医疗费用',
            'term': 12,
            'status': 'VERIFICATION_FAILED',
            'node': 'VERIFICATION',
            'handler': None,
            'created_by': 'credit_officer_02',
            'created_at': (now - timedelta(days=10)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now - timedelta(days=3)).strftime('%Y-%m-%d'),
            'due': (now + timedelta(days=20)).strftime('%Y-%m-%d'),
            'remark': '核验失败案例：征信不良，核验未通过',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_02'),
                ('INCOME_PROOF', '收入证明', 1, 'APPLICATION', 'credit_officer_02'),
                ('CREDIT_REPORT', '征信报告(不良)', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('VERIFICATION_RECORD', '核验记录', 1, 'VERIFICATION', 'risk_auditor_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_02', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_02', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验'),
                ('VERIFY_FAIL', 'PENDING_VERIFICATION', 'VERIFICATION_FAILED', 'risk_auditor_01', 'RISK_AUDITOR', 'VERIFICATION', '征信报告显示有多次逾期记录，核验不通过'),
            ],
            'exceptions': [
                ('VERIFICATION_FAILED', '核验失败', '征信报告显示近2年有5次逾期记录，风险较高', 'risk_auditor_01', (now - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=20)).strftime('%Y%m%d') + '0007',
            'name': '冯完成',
            'id_card': '110101199607077890',
            'phone': '13800000007',
            'amount': 20000,
            'purpose': '旅游消费',
            'term': 6,
            'status': 'COMPLETED',
            'node': 'APPROVAL',
            'handler': None,
            'created_by': 'credit_officer_01',
            'created_at': (now - timedelta(days=20)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now - timedelta(days=13)).strftime('%Y-%m-%d'),
            'due': (now - timedelta(days=10)).strftime('%Y-%m-%d'),
            'remark': '已完成案例：全流程正常流转并放款完成',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_01'),
                ('INCOME_PROOF', '收入证明', 1, 'APPLICATION', 'credit_officer_01'),
                ('CREDIT_REPORT', '征信报告', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('VERIFICATION_RECORD', '核验记录', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('APPROVAL_OPINION', '审批意见', 1, 'APPROVAL', 'supervisor_01'),
                ('DISBURSEMENT_VOUCHER', '放款凭证', 1, 'APPROVAL', 'supervisor_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_01', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_01', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验'),
                ('VERIFY_PASS', 'PENDING_VERIFICATION', 'VERIFICATION_PASSED', 'risk_auditor_01', 'RISK_AUDITOR', 'APPROVAL', '核验通过'),
                ('APPROVE', 'VERIFICATION_PASSED', 'APPROVED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '审批通过'),
                ('COMPLETE', 'APPROVED', 'COMPLETED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '放款完成'),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=2)).strftime('%Y%m%d') + '0008',
            'name': '蒋临期',
            'id_card': '110101199708088901',
            'phone': '13800000008',
            'amount': 70000,
            'purpose': '家电购置',
            'term': 18,
            'status': 'PENDING_VERIFICATION',
            'node': 'VERIFICATION',
            'handler': 'risk_auditor_01',
            'created_by': 'credit_officer_02',
            'created_at': (now - timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now + timedelta(days=1)).strftime('%Y-%m-%d'),
            'due': (now + timedelta(days=28)).strftime('%Y-%m-%d'),
            'remark': '临期案例：核验时限还有1天，属于临期预警队列',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_02'),
                ('INCOME_PROOF', '收入证明', 1, 'APPLICATION', 'credit_officer_02'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_02', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_02', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验'),
            ]
        },
    ]

    for app in applications:
        cursor = c.execute(
            '''INSERT INTO loan_applications
               (application_no, applicant_name, id_card, phone, amount, purpose,
                term_months, status, current_node, current_handler, created_by,
                created_at, verification_due_date, due_date, remark, version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3)''',
            (app['no'], app['name'], app['id_card'], app['phone'],
             app['amount'], app['purpose'], app['term'], app['status'],
             app['node'], app['handler'], app['created_by'], app['created_at'],
             app['ver_due'], app['due'], app['remark'])
        )
        app_id = cursor.lastrowid

        for att in app.get('attachments', []):
            c.execute(
                '''INSERT INTO attachments
                   (loan_application_id, attach_type, attach_name, is_required, node, uploaded_by)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (app_id, att[0], att[1], att[2], att[3], att[4])
            )

        for rec in app.get('records', []):
            c.execute(
                '''INSERT INTO processing_records
                   (loan_application_id, action, from_status, to_status, handler, handler_role, node, remark)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (app_id, rec[0], rec[1], rec[2], rec[3], rec[4], rec[5], rec[6])
            )

        for exc in app.get('exceptions', []):
            c.execute(
                '''INSERT INTO exception_reasons
                   (loan_application_id, exception_type, reason, detail, detected_by, detected_at)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (app_id, exc[0], exc[1], exc[2], exc[3], exc[4])
            )

    audit_notes = [
        (1, '月底复核时注意核对该笔贷款用途真实性', 'supervisor_01'),
        (4, '逾期严重，需重点关注责任人', 'supervisor_01'),
        (5, '退回补正后请尽快重新提交，避免月底积压', 'supervisor_01'),
    ]
    for note in audit_notes:
        c.execute(
            "INSERT INTO audit_notes (loan_application_id, note, created_by) VALUES (?, ?, ?)",
            note
        )

    db.commit()
    db.close()
    print('演示数据初始化完成')
    print(f'  用户数: {len(users)}')
    print(f'  申请单数: {len(applications)}')
    print()
    print('账号列表（密码均为 123456）:')
    print('  信贷员: credit_officer_01 (张信贷) / credit_officer_02 (李信贷)')
    print('  风控:   risk_auditor_01 (王风控) / risk_auditor_02 (赵风控)')
    print('  主管:   supervisor_01 (陈主管)')
    print()
    print('四类演示数据:')
    print('  1. 正常流转: LA...0001（刘正常）- 核验完成待审批')
    print('  2. 缺材料:   LA...0003（孙缺料）- 缺少收入证明')
    print('  3. 超时逾期: LA...0004（周超时）- 核验已逾期8天')
    print('  4. 退回补正: LA...0005（吴补正）- 已退回信贷员补正')
    print()
    print('附加案例:')
    print('  - 待核验: LA...0002（钱待核）')
    print('  - 核验失败: LA...0006（郑失败）')
    print('  - 已完成: LA...0007（冯完成）')
    print('  - 临期预警: LA...0008（蒋临期）')


if __name__ == '__main__':
    init_db()
    seed_data()
