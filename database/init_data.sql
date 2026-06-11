PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (username, password_hash, real_name, role, department) VALUES
('registrar', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYGyJzHpxM.5yWq', '张三', 'registrar', '法律咨询部'),
('supervisor', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYGyJzHpxM.5yWq', '李四', 'supervisor', '法务服务中心'),
('reviewer', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYGyJzHpxM.5yWq', '王五', 'reviewer', '法务服务中心'),
('director', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYGyJzHpxM.5yWq', '赵六', 'director', '律所'),
('assistant', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYGyJzHpxM.5yWq', '孙七', 'assistant', '律师团队'),
('lawyer', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYGyJzHpxM.5yWq', '周八', 'lawyer', '律师团队');

INSERT OR IGNORE INTO legal_cases (case_no, title, priority, status, queue, current_handler_id, deadline, version, created_by, created_at, updated_at) VALUES
('LC2026060001', '正常流转-劳动合同纠纷咨询', 'high', 'completed', 'archive', 6, '2026-06-20 18:00:00', 5, 1, '2026-06-01 10:00:00', '2026-06-08 15:30:00'),
('LC2026060002', '缺材料-买卖合同咨询', 'normal', 'pending_submit', 'registration', 1, '2026-06-25 18:00:00', 2, 1, '2026-06-03 14:00:00', '2026-06-05 11:20:00'),
('LC2026060003', '超时逾期-知识产权侵权咨询', 'high', 'reviewing', 'review', 3, '2026-06-05 18:00:00', 4, 1, '2026-05-20 09:00:00', '2026-06-02 16:45:00'),
('LC2026060004', '退回补正-公司股权变更咨询', 'normal', 'returned', 'registration', 1, '2026-06-30 18:00:00', 3, 1, '2026-06-02 10:30:00', '2026-06-06 09:15:00');

INSERT OR IGNORE INTO case_registration (case_id, client_name, client_phone, client_id_card, consultation_type, consultation_content, evidence_provided, registration_remark, registered_by, registered_at, is_complete) VALUES
(1, '王明', '13800138001', '110101199001011234', '劳动合同', '公司无故解除劳动合同，要求支付经济赔偿金', '劳动合同、工资条、解除通知', '客户情绪稳定，证据充分', 1, '2026-06-01 10:30:00', 1),
(2, '李华', '13900139002', NULL, '买卖合同', '购买的商品存在质量问题，要求退货退款', '购物发票', '缺少商品质检报告和银行流水', 1, '2026-06-03 14:30:00', 0),
(3, '张伟', '13700137003', '310101198505055678', '知识产权', '发现其他公司侵犯我方商标权', '商标注册证、侵权产品照片', '案件复杂，需要律师团队深度介入', 1, '2026-05-20 09:30:00', 1),
(4, '陈静', '13600136004', NULL, '公司法', '公司股权变更手续办理咨询', NULL, '缺少股东身份证明和股权转让协议，已退回补正', 1, '2026-06-02 11:00:00', 0);

INSERT OR IGNORE INTO case_assignment (case_id, assistant_id, lawyer_id, assignment_reason, assignment_remark, assigned_by, assigned_at, is_complete) VALUES
(1, 5, 6, '劳动争议案件，周律师擅长劳动纠纷', '案件紧急，优先处理', 2, '2026-06-02 09:00:00', 1),
(2, NULL, NULL, NULL, '待登记信息补全后分派', 2, NULL, 0),
(3, 5, 6, '知识产权案件，需要团队协作', '已超过处理时限，需尽快处理', 2, '2026-05-21 10:00:00', 1),
(4, NULL, NULL, NULL, '案件已退回，待补正后重新分派', 2, NULL, 0);

INSERT OR IGNORE INTO case_followup (case_id, followup_result, client_satisfaction, followup_remark, followup_by, followup_at, is_complete) VALUES
(1, '已通过劳动仲裁调解，客户获得赔偿金15万元', 'very_satisfied', '客户对处理结果非常满意，已结案', 6, '2026-06-08 15:00:00', 1),
(2, NULL, NULL, '待案件分派后进行回访', NULL, NULL, 0),
(3, '已发送律师函，对方表示愿意协商', 'satisfied', '客户对当前进展满意，等待对方回复', 6, '2026-06-01 14:00:00', 1),
(4, NULL, NULL, '案件已退回，待补正完成后回访', NULL, NULL, 0);

INSERT OR IGNORE INTO processing_records (case_id, action, from_status, to_status, operator_id, remark, created_at) VALUES
(1, 'create', NULL, 'draft', 1, '创建咨询单', '2026-06-01 10:00:00'),
(1, 'submit', 'draft', 'pending_submit', 1, '提交审核', '2026-06-01 10:30:00'),
(1, 'review', 'pending_submit', 'submitted', 2, '审核通过', '2026-06-01 14:00:00'),
(1, 'assign', 'submitted', 'assigned', 2, '分派给周八律师和孙七助理', '2026-06-02 09:00:00'),
(1, 'complete', 'assigned', 'completed', 6, '案件处理完成', '2026-06-08 15:00:00'),
(1, 'archive', 'completed', 'archived', 3, '复核归档', '2026-06-08 15:30:00'),
(2, 'create', NULL, 'draft', 1, '创建咨询单', '2026-06-03 14:00:00'),
(2, 'submit', 'draft', 'pending_submit', 1, '提交审核（材料不全）', '2026-06-05 11:20:00'),
(3, 'create', NULL, 'draft', 1, '创建咨询单', '2026-05-20 09:00:00'),
(3, 'submit', 'draft', 'pending_submit', 1, '提交审核', '2026-05-20 09:30:00'),
(3, 'review', 'pending_submit', 'submitted', 2, '审核通过', '2026-05-20 14:00:00'),
(3, 'assign', 'submitted', 'assigned', 2, '分派给周八律师和孙七助理', '2026-05-21 10:00:00'),
(3, 'review', 'assigned', 'reviewing', 2, '提交复核（已逾期）', '2026-06-02 16:45:00'),
(4, 'create', NULL, 'draft', 1, '创建咨询单', '2026-06-02 10:30:00'),
(4, 'submit', 'draft', 'pending_submit', 1, '提交审核', '2026-06-02 11:00:00'),
(4, 'return', 'pending_submit', 'returned', 2, '缺少股东身份证明和股权转让协议，退回补正', '2026-06-06 09:15:00');

INSERT OR IGNORE INTO audit_notes (case_id, module, audit_type, content, operator_id, created_at) VALUES
(1, 'registration', 'approve', '咨询登记信息完整，客户姓名、电话、身份证号、咨询类型、咨询内容、证据材料齐全', 2, '2026-06-01 14:00:00'),
(1, 'assignment', 'approve', '案件分派信息完整，已指定助理孙七和律师周八，分派理由充分', 2, '2026-06-02 09:00:00'),
(1, 'followup', 'approve', '回访确认信息完整，回访结果、客户满意度均已记录', 3, '2026-06-08 15:30:00'),
(2, 'registration', 'incomplete', '信息拦截：缺少客户身份证号和银行流水证据，案件停在登记队列', 2, '2026-06-05 11:30:00'),
(3, 'registration', 'approve', '咨询登记信息完整', 2, '2026-05-20 14:00:00'),
(3, 'assignment', 'approve', '案件分派信息完整', 2, '2026-05-21 10:00:00'),
(3, 'deadline', 'overdue', '预警：案件已超过截止日期2026-06-05，请尽快处理', 2, '2026-06-06 08:00:00'),
(4, 'registration', 'reject', '审核退回：缺少股东身份证明和股权转让协议，请补正后重新提交', 2, '2026-06-06 09:15:00');

INSERT OR IGNORE INTO exception_reasons (case_id, exception_type, reason, module, operator_id, created_at) VALUES
(2, 'incomplete_data', '咨询登记信息不完整：缺少客户身份证号、咨询方式、接待人员信息', 'registration', 2, '2026-06-05 11:30:00'),
(2, 'missing_evidence', '缺少必要证据材料：银行交易流水、商品质检报告', 'registration', 2, '2026-06-05 11:30:00'),
(3, 'overdue', '案件处理超时：截止日期为2026-06-05，当前已逾期6天', 'review', NULL, '2026-06-11 08:00:00'),
(4, 'status_conflict', '状态冲突：案件已退回，不能直接推进到下一阶段', 'registration', 2, '2026-06-06 09:15:00'),
(4, 'incomplete_data', '咨询登记信息不完整：缺少客户身份证号、股权转让协议、股东会决议', 'registration', 2, '2026-06-06 09:15:00');
