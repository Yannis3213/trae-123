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
            ],
            'audit_notes': [
                ('全流程正常，资料完整，可作为月底复核标准样板', 'supervisor_01'),
                ('三节点证据齐全，状态流转与处理记录一致', 'supervisor_01'),
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
        {
            'no': 'LA' + (now - timedelta(days=4)).strftime('%Y%m%d') + '0009',
            'name': '沈待批',
            'id_card': '110101199809099012',
            'phone': '13800000009',
            'amount': 90000,
            'purpose': '小微企业经营',
            'term': 12,
            'status': 'VERIFICATION_PASSED',
            'node': 'APPROVAL',
            'handler': 'supervisor_01',
            'created_by': 'credit_officer_02',
            'created_at': (now - timedelta(days=4)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now + timedelta(days=3)).strftime('%Y-%m-%d'),
            'due': (now + timedelta(days=26)).strftime('%Y-%m-%d'),
            'remark': '审批缺料案例：核验已通过，但缺少审批意见，主管审批时应被证据校验拦截',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_02'),
                ('INCOME_PROOF', '营业执照+经营流水', 1, 'APPLICATION', 'credit_officer_02'),
                ('CREDIT_REPORT', '企业征信报告', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('VERIFICATION_RECORD', '核验记录表', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('DISBURSEMENT_VOUCHER', '放款凭证草稿(待审批后补充)', 0, 'APPROVAL', 'supervisor_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_02', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_02', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验'),
                ('VERIFY_PASS', 'PENDING_VERIFICATION', 'VERIFICATION_PASSED', 'risk_auditor_01', 'RISK_AUDITOR', 'APPROVAL', '核验通过，材料齐全'),
            ],
            'exceptions': [
                ('MISSING_EVIDENCE', '审批证据不全', '缺少审批意见(APPROVAL_OPINION)，主管需上传后才能审批通过', 'supervisor_01', (now - timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S'), None, None),
            ],
            'audit_notes': [
                ('月底复核重点：核验通过后，审批证据不齐不能推进，防止越权放款', 'supervisor_01'),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=35)).strftime('%Y%m%d') + '0010',
            'name': '褚归档',
            'id_card': '110101199910100123',
            'phone': '13800000010',
            'amount': 55000,
            'purpose': '家居装修',
            'term': 24,
            'status': 'COMPLETED',
            'node': 'APPROVAL',
            'handler': None,
            'created_by': 'credit_officer_01',
            'created_at': (now - timedelta(days=35)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now - timedelta(days=28)).strftime('%Y-%m-%d'),
            'due': (now - timedelta(days=25)).strftime('%Y-%m-%d'),
            'remark': '已归档案例：上个月月底完成归档，冻结所有编辑操作',
            'is_archived': 1,
            'archived_at': (now - timedelta(days=25)).strftime('%Y-%m-%d %H:%M:%S'),
            'archived_by': 'supervisor_01',
            'review_note': '【月底复核】全流程合规，三节点证据齐全，审批手续完整，同意归档。借款人征信良好，还款能力充足，无异常记录。',
            'reviewed_by': 'supervisor_01',
            'reviewed_at': (now - timedelta(days=25)).strftime('%Y-%m-%d %H:%M:%S'),
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
                ('REVIEW', 'COMPLETED', 'COMPLETED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '月底复核通过，添加复核备注'),
                ('ARCHIVE', 'COMPLETED', 'COMPLETED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '月底归档，冻结所有编辑操作'),
            ],
            'audit_notes': [
                ('归档后不可编辑，如需修改请先解除归档', 'supervisor_01'),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=30)).strftime('%Y%m%d') + '0011',
            'name': '卫已解',
            'id_card': '110101200011111234',
            'phone': '13800000011',
            'amount': 40000,
            'purpose': '教育培训',
            'term': 12,
            'status': 'COMPLETED',
            'node': 'APPROVAL',
            'handler': None,
            'created_by': 'credit_officer_02',
            'created_at': (now - timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now - timedelta(days=23)).strftime('%Y-%m-%d'),
            'due': (now - timedelta(days=20)).strftime('%Y-%m-%d'),
            'remark': '异常已解除案例：曾因材料缺失退回，补正后完成全部流程并解除异常',
            'attachments': [
                ('ID_CARD', '身份证', 1, 'APPLICATION', 'credit_officer_02'),
                ('INCOME_PROOF', '收入证明', 1, 'APPLICATION', 'credit_officer_02'),
                ('CREDIT_REPORT', '征信报告', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('VERIFICATION_RECORD', '核验记录', 1, 'VERIFICATION', 'risk_auditor_01'),
                ('APPROVAL_OPINION', '审批意见', 1, 'APPROVAL', 'supervisor_01'),
                ('DISBURSEMENT_VOUCHER', '放款凭证', 1, 'APPROVAL', 'supervisor_01'),
            ],
            'records': [
                ('CREATE', None, 'DRAFT', 'credit_officer_02', 'CREDIT_OFFICER', 'APPLICATION', '创建申请单'),
                ('SUBMIT', 'DRAFT', 'PENDING_VERIFICATION', 'credit_officer_02', 'CREDIT_OFFICER', 'VERIFICATION', '提交核验'),
                ('RETURN_CORRECTION', 'PENDING_VERIFICATION', 'CORRECTION_REQUIRED', 'risk_auditor_01', 'RISK_AUDITOR', 'APPLICATION', '收入证明缺失，退回补正'),
                ('SUBMIT', 'CORRECTION_REQUIRED', 'PENDING_VERIFICATION', 'credit_officer_02', 'CREDIT_OFFICER', 'VERIFICATION', '补正收入证明后重新提交'),
                ('VERIFY_PASS', 'PENDING_VERIFICATION', 'VERIFICATION_PASSED', 'risk_auditor_01', 'RISK_AUDITOR', 'APPROVAL', '核验通过'),
                ('APPROVE', 'VERIFICATION_PASSED', 'APPROVED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '审批通过'),
                ('COMPLETE', 'APPROVED', 'COMPLETED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '放款完成'),
                ('RESOLVE_EXCEPTION', 'COMPLETED', 'COMPLETED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '月底复核确认异常已解决，解除异常标记'),
            ],
            'exceptions': [
                ('RETURNED', '退回补正', '收入证明缺失，请补充后重新提交', 'risk_auditor_01', (now - timedelta(days=28)).strftime('%Y-%m-%d %H:%M:%S'),
                 'supervisor_01', (now - timedelta(days=20)).strftime('%Y-%m-%d %H:%M:%S'), '收入证明已补正，完整有效，借款人资质符合要求'),
            ],
            'audit_notes': [
                ('异常解除后可正常归档，解除过程已留痕', 'supervisor_01'),
            ]
        },
        {
            'no': 'LA' + (now - timedelta(days=12)).strftime('%Y%m%d') + '0012',
            'name': '蒋复核',
            'id_card': '110101200112122345',
            'phone': '13800000012',
            'amount': 75000,
            'purpose': '汽车消费',
            'term': 36,
            'status': 'COMPLETED',
            'node': 'APPROVAL',
            'handler': None,
            'created_by': 'credit_officer_01',
            'created_at': (now - timedelta(days=12)).strftime('%Y-%m-%d %H:%M:%S'),
            'ver_due': (now - timedelta(days=5)).strftime('%Y-%m-%d'),
            'due': (now - timedelta(days=2)).strftime('%Y-%m-%d'),
            'remark': '待归档案例：本月已完成放款，有复核备注，待月底归档',
            'review_note': '【月底复核】资料完整，流程合规，符合归档条件。建议本月月底集中归档。',
            'reviewed_by': 'supervisor_01',
            'reviewed_at': (now - timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S'),
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
                ('REVIEW', 'COMPLETED', 'COMPLETED', 'supervisor_01', 'LOAN_SUPERVISOR', 'APPROVAL', '月底复核，添加复核备注，待月底归档'),
            ],
            'audit_notes': [
                ('有复核备注，可直接月底归档', 'supervisor_01'),
            ]
        },
    ]

    for app in applications:
        cursor = c.execute(
            '''INSERT INTO loan_applications
               (application_no, applicant_name, id_card, phone, amount, purpose,
                term_months, status, current_node, current_handler, created_by,
                created_at, verification_due_date, due_date, remark, version,
                is_archived, archived_at, archived_by, review_note, reviewed_by, reviewed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3, ?, ?, ?, ?, ?, ?)''',
            (app['no'], app['name'], app['id_card'], app['phone'],
             app['amount'], app['purpose'], app['term'], app['status'],
             app['node'], app['handler'], app['created_by'], app['created_at'],
             app['ver_due'], app['due'], app['remark'],
             app.get('is_archived', 0), app.get('archived_at'), app.get('archived_by'),
             app.get('review_note'), app.get('reviewed_by'), app.get('reviewed_at'))
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
                   (loan_application_id, exception_type, reason, detail, detected_by, detected_at,
                    resolved_by, resolved_at, resolution)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (app_id, exc[0], exc[1], exc[2], exc[3], exc[4],
                 exc[5] if len(exc) > 5 else None,
                 exc[6] if len(exc) > 6 else None,
                 exc[7] if len(exc) > 7 else None)
            )

        for note in app.get('audit_notes', []):
            c.execute(
                '''INSERT INTO audit_notes
                   (loan_application_id, note, created_by)
                   VALUES (?, ?, ?)''',
                (app_id, note[0], note[1])
            )

    audit_notes = [
        (1, '月底复核时注意核对该笔贷款用途真实性', 'supervisor_01'),
        (1, '三节点证据齐全，核验后可正常流转审批与放款', 'supervisor_01'),
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
    print('  1. 正常流转(核验完成待审批): LA...0001（刘正常）- 三节点证据齐全，可继续审批→放款完成')
    print('  2. 缺材料(核验缺证据):       LA...0003（孙缺料）- 缺少征信报告和核验记录')
    print('  3. 超时逾期:                 LA...0004（周超时）- 核验已逾期8天')
    print('  4. 退回补正:                 LA...0005（吴补正）- 已退回信贷员补正')
    print()
    print('审批放款链路演示:')
    print('  - 核验完成待审批(证据齐全): LA...0001（刘正常）- 主管登录后可审批→完成放款')
    print('  - 核验完成待审批(缺审批意见): LA...0009（沈待批）- 演示审批阶段证据拦截')
    print('  - 已完成(全链路走完):        LA...0007（冯完成）- 含三节点完整证据与处理记录')
    print()
    print('月底归档与复核闭环演示（主管视角）:')
    print('  - 已归档(冻结不可编辑):      LA...0010（褚归档）- 含归档标记、复核备注、解除归档入口')
    print('  - 异常已解除:                LA...0011（卫已解）- 含已解除异常、解除时间/人/说明')
    print('  - 待归档(有复核备注):        LA...0012（蒋复核）- 含复核备注、待月底归档、可批量归档')
    print()
    print('附加案例:')
    print('  - 待核验(齐全):      LA...0002（钱待核）')
    print('  - 核验失败:          LA...0006（郑失败）')
    print('  - 临期预警(1天到期): LA...0008（蒋临期）')


if __name__ == '__main__':
    init_db()
    seed_data()
