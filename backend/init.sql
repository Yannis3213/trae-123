PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS exception_reasons;
DROP TABLE IF EXISTS audit_notes;
DROP TABLE IF EXISTS processing_records;
DROP TABLE IF EXISTS evidence_requirements;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS finance_applications;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    real_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_applications (
    id TEXT PRIMARY KEY,
    application_no TEXT NOT NULL UNIQUE,
    clue_no TEXT,
    customer_name TEXT NOT NULL,
    finance_amount REAL NOT NULL,
    invoice_count INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    current_handler TEXT,
    current_node TEXT NOT NULL,
    node_deadline DATETIME,
    version INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    invoice_verify_status TEXT DEFAULT 'pending',
    loan_confirm_status TEXT DEFAULT 'pending',
    correction_count INTEGER DEFAULT 0,
    remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_status ON finance_applications(status);
CREATE INDEX IF NOT EXISTS idx_app_clue ON finance_applications(clue_no);
CREATE INDEX IF NOT EXISTS idx_app_handler ON finance_applications(current_handler);
CREATE INDEX IF NOT EXISTS idx_app_node ON finance_applications(current_node);
CREATE INDEX IF NOT EXISTS idx_app_invoice_status ON finance_applications(invoice_verify_status);
CREATE INDEX IF NOT EXISTS idx_app_loan_status ON finance_applications(loan_confirm_status);

CREATE TABLE IF NOT EXISTS evidence_requirements (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    evidence_name TEXT NOT NULL,
    required INTEGER DEFAULT 1,
    provided INTEGER DEFAULT 0,
    attachment_id TEXT,
    required_by_role TEXT,
    required_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    provided_at DATETIME,
    remark TEXT,
    FOREIGN KEY (application_id) REFERENCES finance_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ev_req_app ON evidence_requirements(application_id);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    evidence_type TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES finance_applications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attach_app ON attachments(application_id);

CREATE TABLE IF NOT EXISTS processing_records (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    from_node TEXT,
    to_node TEXT,
    action TEXT NOT NULL,
    handler TEXT NOT NULL,
    handler_role TEXT NOT NULL,
    acting_role TEXT,
    comment TEXT,
    correction_note TEXT,
    evidence_required TEXT,
    evidence_provided TEXT,
    invoice_status_before TEXT,
    invoice_status_after TEXT,
    loan_status_before TEXT,
    loan_status_after TEXT,
    version_before INTEGER,
    version_after INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES finance_applications(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_record_app ON processing_records(application_id);
CREATE INDEX IF NOT EXISTS idx_record_time ON processing_records(created_at);
CREATE INDEX IF NOT EXISTS idx_record_role ON processing_records(handler_role);

CREATE TABLE IF NOT EXISTS audit_notes (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    note TEXT NOT NULL,
    note_type TEXT DEFAULT 'general',
    related_record_id TEXT,
    related_exception_id TEXT,
    created_by TEXT NOT NULL,
    created_by_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES finance_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (related_record_id) REFERENCES processing_records(id) ON DELETE SET NULL,
    FOREIGN KEY (related_exception_id) REFERENCES exception_reasons(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_app ON audit_notes(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_excp ON audit_notes(related_exception_id);

CREATE TABLE IF NOT EXISTS exception_reasons (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,
    record_id TEXT,
    audit_note_id TEXT,
    exception_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    severity TEXT DEFAULT 'warning',
    source_role TEXT,
    resolved INTEGER DEFAULT 0,
    resolved_by TEXT,
    resolved_by_role TEXT,
    resolved_note TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES finance_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (record_id) REFERENCES processing_records(id) ON DELETE SET NULL,
    FOREIGN KEY (audit_note_id) REFERENCES audit_notes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_excp_app ON exception_reasons(application_id);
CREATE INDEX IF NOT EXISTS idx_excp_resolved ON exception_reasons(resolved);
CREATE INDEX IF NOT EXISTS idx_excp_type ON exception_reasons(exception_type);

INSERT OR IGNORE INTO roles (id, name, description) VALUES
('register', '融资申请登记员', '负责融资申请单的创建、补正材料'),
('auditor', '融资申请审核主管', '负责融资申请的过程核验、风险审核'),
('reviewer', '供应链金融平台复核负责人', '负责复核归档、放款确认');

INSERT OR IGNORE INTO users (id, username, password, real_name) VALUES
('u1', 'register01', '123456', '张登记'),
('u2', 'auditor01', '123456', '李审核'),
('u3', 'reviewer01', '123456', '王复核'),
('u4', 'admin', '123456', '系统管理员');

INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES
('u1', 'register'),
('u2', 'auditor'),
('u3', 'reviewer'),
('u4', 'register'),
('u4', 'auditor'),
('u4', 'reviewer');

INSERT OR IGNORE INTO finance_applications 
(id, application_no, clue_no, customer_name, finance_amount, invoice_count, status, current_handler, current_node, version, created_by, invoice_verify_status, loan_confirm_status, remark, node_deadline, correction_count)
VALUES
('app001', 'RZ202506001', 'XS202506001', '华东供应链有限公司', 5000000.00, 12, 'pending_verify', 'u2', 'register_done', 2, 'u1', 'pending', 'pending', '正常流转样例', datetime('now', '+3 days'), 0),
('app002', 'RZ202506002', 'XS202506002', '南方贸易集团', 3200000.00, 8, 'pending_verify', 'u2', 'register_done', 2, 'u1', 'failed', 'pending', '缺材料样例-发票核验失败', datetime('now', '+5 days'), 0),
('app003', 'RZ202506003', 'XS202506003', '北方物流股份', 8000000.00, 20, 'pending_correction', 'u1', 'verify_rejected', 3, 'u1', 'pending', 'pending', '退回补正样例-风控审核退回', datetime('now', '-1 days'), 1),
('app004', 'RZ202506004', 'XS202506004', '西部建材有限公司', 1500000.00, 5, 'overdue', 'u2', 'register_done', 2, 'u1', 'pending', 'pending', '逾期样例-节点超时', datetime('now', '-3 days'), 0),
('app005', 'RZ202506005', 'XS202506005', '中部电子科技', 6500000.00, 15, 'verify_passed', 'u3', 'verify_done', 2, 'u1', 'passed', 'pending', '待复核样例', datetime('now', '+2 days'), 0),
('app006', 'RZ202506006', 'XS202506006', '沿海食品加工', 2800000.00, 7, 'archived', NULL, 'review_done', 4, 'u1', 'passed', 'confirmed', '已归档样例', datetime('now', '-7 days'), 2),
('app007', 'RZ202506007', 'XS202506007', '东北机械制造', 4200000.00, 11, 'pending_correction', 'u1', 'review_returned', 3, 'u1', 'passed', 'pending', '复核退回补正样例', datetime('now', '-2 days'), 1);

INSERT OR IGNORE INTO attachments (id, application_id, file_name, file_type, file_size, evidence_type, uploaded_by) VALUES
('att001', 'app001', '购销合同.pdf', 'application/pdf', 1024000, 'contract', 'u1'),
('att002', 'app001', '增值税发票_01.pdf', 'application/pdf', 512000, 'invoice', 'u1'),
('att003', 'app001', '增值税发票_02.pdf', 'application/pdf', 486000, 'invoice', 'u1'),
('att004', 'app002', '购销合同.pdf', 'application/pdf', 980000, 'contract', 'u1'),
('att005', 'app003', '购销合同.pdf', 'application/pdf', 1100000, 'contract', 'u1'),
('att006', 'app005', '购销合同.pdf', 'application/pdf', 1050000, 'contract', 'u1'),
('att007', 'app005', '发票清单.xlsx', 'application/vnd.openxmlformats', 256000, 'invoice_list', 'u1'),
('att008', 'app006', '购销合同.pdf', 'application/pdf', 900000, 'contract', 'u1'),
('att009', 'app006', '放款凭证.pdf', 'application/pdf', 380000, 'loan_voucher', 'u3'),
('att010', 'app007', '购销合同.pdf', 'application/pdf', 1080000, 'contract', 'u1'),
('att011', 'app007', '增值税发票.pdf', 'application/pdf', 620000, 'invoice', 'u1');

INSERT OR IGNORE INTO evidence_requirements (id, application_id, evidence_type, evidence_name, required, provided, attachment_id, required_by_role, required_at, remark) VALUES
('evr001', 'app001', 'contract', '购销合同', 1, 1, 'att001', 'auditor', datetime('now', '-1 day'), '核验必备材料'),
('evr002', 'app001', 'invoice', '增值税发票', 1, 1, NULL, 'auditor', datetime('now', '-1 day'), '需要发票数量匹配合同金额'),
('evr003', 'app002', 'contract', '购销合同', 1, 1, 'att004', 'auditor', datetime('now', '-1 day'), NULL),
('evr004', 'app002', 'invoice', '增值税专用发票', 1, 0, NULL, 'auditor', datetime('now', '-1 day'), '缺少8张发票只提供0张'),
('evr005', 'app003', 'contract', '购销合同', 1, 1, 'att005', 'auditor', datetime('now', '-2 day'), NULL),
('evr006', 'app003', 'invoice', '增值税发票', 1, 0, NULL, 'auditor', datetime('now', '-1 day'), '退回补正：金额不匹配'),
('evr007', 'app004', 'contract', '购销合同', 1, 0, NULL, 'auditor', datetime('now', '-3 day'), '逾期未补齐'),
('evr008', 'app005', 'contract', '购销合同', 1, 1, 'att006', 'auditor', datetime('now', '-2 day'), NULL),
('evr009', 'app005', 'invoice_list', '发票清单', 1, 1, 'att007', 'auditor', datetime('now', '-2 day'), NULL),
('evr010', 'app006', 'contract', '购销合同', 1, 1, 'att008', 'auditor', datetime('now', '-8 day'), NULL),
('evr011', 'app006', 'loan_voucher', '放款凭证', 1, 1, 'att009', 'reviewer', datetime('now', '-7 day'), NULL),
('evr012', 'app007', 'contract', '购销合同', 1, 1, 'att010', 'reviewer', datetime('now', '-3 day'), NULL),
('evr013', 'app007', 'invoice', '增值税发票', 1, 1, 'att011', 'reviewer', datetime('now', '-2 day'), '复核退回：发票号码有误');

INSERT OR IGNORE INTO processing_records (id, application_id, from_status, to_status, from_node, to_node, action, handler, handler_role, acting_role, comment, correction_note, evidence_required, evidence_provided, invoice_status_before, invoice_status_after, loan_status_before, loan_status_after, version_before, version_after) VALUES
('rec001', 'app001', NULL, 'pending_verify', NULL, 'register_done', 'create', 'u1', 'register', 'register', '创建融资申请单', NULL, NULL, NULL, NULL, 'pending', NULL, 'pending', 1, 1),
('rec002', 'app001', 'draft', 'pending_verify', 'register', 'register_done', 'submit', 'u1', 'register', 'register', '提交核验', NULL, 'contract,invoice', 'contract,invoice', NULL, 'pending', NULL, 'pending', 1, 2),
('rec003', 'app002', NULL, 'pending_verify', NULL, 'register_done', 'create', 'u1', 'register', 'register', '创建融资申请单', NULL, NULL, NULL, NULL, 'pending', NULL, 'pending', 1, 1),
('rec004', 'app002', 'draft', 'pending_verify', 'register', 'register_done', 'submit', 'u1', 'register', 'register', '提交核验-材料不全', NULL, 'contract,invoice', 'contract', 'pending', 'failed', NULL, 'pending', 1, 2),
('rec005', 'app003', NULL, 'pending_verify', NULL, 'register_done', 'create', 'u1', 'register', 'register', '创建融资申请单', NULL, NULL, NULL, NULL, 'pending', NULL, 'pending', 1, 1),
('rec006', 'app003', 'pending_verify', 'pending_correction', 'register_done', 'verify_rejected', 'reject', 'u2', 'auditor', 'auditor', '材料不符合要求，退回补正', '合同金额800万与发票金额680万不匹配，相差15%',
 'contract,invoice', 'contract', 'pending', 'pending', NULL, 'pending', 2, 3),
('rec007', 'app004', NULL, 'pending_verify', NULL, 'register_done', 'create', 'u1', 'register', 'register', '创建融资申请单', NULL, NULL, NULL, NULL, 'pending', NULL, 'pending', 1, 1),
('rec008', 'app004', 'draft', 'pending_verify', 'register', 'register_done', 'submit', 'u1', 'register', 'register', '提交核验-已逾期', NULL, NULL, NULL, 'pending', 'pending', NULL, 'pending', 1, 2),
('rec009', 'app005', NULL, 'pending_verify', NULL, 'register_done', 'create', 'u1', 'register', 'register', '创建融资申请单', NULL, NULL, NULL, NULL, 'pending', NULL, 'pending', 1, 1),
('rec010', 'app005', 'pending_verify', 'verify_passed', 'register_done', 'verify_done', 'pass', 'u2', 'auditor', 'auditor', '核验通过，提交复核', NULL, 'contract,invoice_list', 'contract,invoice_list', 'pending', 'passed', NULL, 'pending', 1, 2),
('rec011', 'app006', NULL, 'pending_verify', NULL, 'register_done', 'create', 'u1', 'register', 'register', '创建融资申请单', NULL, NULL, NULL, NULL, 'pending', NULL, 'pending', 1, 1),
('rec012', 'app006', 'pending_verify', 'verify_passed', 'register_done', 'verify_done', 'pass', 'u2', 'auditor', 'auditor', '核验通过', NULL, 'contract,invoice', 'contract,invoice', 'pending', 'passed', NULL, 'pending', 1, 2),
('rec013', 'app006', 'verify_passed', 'pending_correction', 'verify_done', 'review_returned', 'return', 'u3', 'reviewer', 'reviewer', '复核退回：材料需重新核对', '发票日期与合同日期不一致',
 'contract,invoice,loan_voucher', 'contract,invoice', 'passed', 'passed', NULL, 'pending', 2, 3),
('rec014', 'app006', 'pending_correction', 'verify_passed', 'review_returned', 'verify_done', 'resubmit', 'u1', 'register', 'register', '重新提交复核', NULL, NULL, 'contract,invoice,loan_voucher', NULL, 'passed', NULL, 'pending', 3, 4),
('rec015', 'app006', 'verify_passed', 'archived', 'verify_done', 'review_done', 'archive', 'u3', 'reviewer', 'reviewer', '复核通过，已归档', NULL, NULL, NULL, 'passed', 'passed', 'pending', 'confirmed', 4, 4),
('rec016', 'app007', NULL, 'pending_verify', NULL, 'register_done', 'create', 'u1', 'register', 'register', '创建融资申请单', NULL, NULL, NULL, NULL, 'pending', NULL, 'pending', 1, 1),
('rec017', 'app007', 'pending_verify', 'verify_passed', 'register_done', 'verify_done', 'pass', 'u2', 'auditor', 'auditor', '核验通过', NULL, 'contract,invoice', 'contract,invoice', 'pending', 'passed', NULL, 'pending', 1, 2),
('rec018', 'app007', 'verify_passed', 'pending_correction', 'verify_done', 'review_returned', 'return', 'u3', 'reviewer', 'reviewer', '复核退回补正', '发票号码有误，需重新核对',
 'contract,invoice', 'contract,invoice', 'passed', 'passed', NULL, 'pending', 2, 3);

INSERT OR IGNORE INTO audit_notes (id, application_id, note, note_type, related_record_id, related_exception_id, created_by, created_by_role) VALUES
('note001', 'app002', '客户承诺下周一补齐缺失的3张增值税发票', 'followup', NULL, NULL, 'u2', 'auditor'),
('note002', 'app003', '客户反馈合同金额需重新核对', 'correction', NULL, NULL, 'u1', 'register'),
('note003', 'app004', '已电话联系客户催办，客户表示明天提交', 'followup', NULL, NULL, 'u2', 'auditor'),
('note004', 'app006', '第一次复核退回原因：发票日期与合同日期差3天', 'exception', 'rec013', NULL, 'u3', 'reviewer'),
('note005', 'app007', '复核退回：发票编号INV-2025-06-011号码重复', 'exception', 'rec018', NULL, 'u3', 'reviewer');

INSERT OR IGNORE INTO exception_reasons (id, application_id, record_id, audit_note_id, exception_type, reason, severity, source_role, resolved, resolved_by, resolved_by_role, resolved_note) VALUES
('exc001', 'app002', 'rec004', NULL, 'missing_material', '缺少3张增值税专用发票，无法完成核验（要求8张仅提供5张）', 'error', 'auditor', 0, NULL, NULL, NULL),
('exc002', 'app003', 'rec006', 'note002', 'reject_correction', '合同金额800万与发票金额680万不匹配，相差15%，请核对后重新提交', 'warning', 'auditor', 0, NULL, NULL, NULL),
('exc003', 'app004', NULL, 'note003', 'overdue', '融资申请登记节点超时，已逾期3天，责任人为李审核（u2）', 'error', 'system', 0, NULL, NULL, NULL),
('exc004', 'app001', NULL, NULL, 'invoice_verify_pending', '发票核验尚未完成，当前待核验12张发票', 'warning', 'system', 0, NULL, NULL, NULL),
('exc005', 'app006', 'rec013', 'note004', 'review_return', '第一次复核退回：发票日期与合同日期不一致', 'warning', 'reviewer', 1, 'u1', 'register', '客户已更换新发票'),
('exc006', 'app007', 'rec018', 'note005', 'review_return', '复核退回：发票号码重复，疑似虚假发票嫌疑', 'error', 'reviewer', 0, NULL, NULL, NULL);
