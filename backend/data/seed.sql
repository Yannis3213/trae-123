INSERT OR IGNORE INTO patrol_orders (id, order_no, station_id, status, priority, inspector_id, engineer_id, manager_id, current_handler, patrol_date, due_date, patrol_content, weather, temperature, patrol_evidence, defect_count, version, previous_handler_id, previous_opinion, audit_remark, anomaly_reason, is_overdue, overdue_level, created_at, updated_at) VALUES
    (1, 'PO202606001', 1, 'pending_dispatch', 'high', 2, NULL, 6, 'inspector', '2026-06-10', '2026-06-12', '月度例行巡检：组件清洗、逆变器检查、箱变巡检、接地系统检测', '晴', '28℃', '["巡检记录表_001.pdf","组件照片_001.jpg","逆变器数据截图_001.png"]', 2, 1, NULL, NULL, NULL, NULL, 0, 'normal', '2026-06-10 08:30:00', '2026-06-10 08:30:00'),
    (2, 'PO202606002', 2, 'in_progress', 'urgent', 2, 4, 6, 'engineer', '2026-06-08', '2026-06-15', '雨季专项巡检：排水系统、组件防水、电缆沟防水、防雷接地', '多云', '25℃', '["雨季巡检记录表_002.pdf","排水系统照片_002.jpg","逆变器温度曲线补充.png"]', 3, 4, 6, '材料已补齐，缺陷已录入，请工程师办理消缺', NULL, NULL, 0, 'near', '2026-06-08 09:00:00', '2026-06-09 11:00:00'),
    (3, 'PO202606003', 3, 'in_progress', 'medium', 3, 5, 7, 'engineer', '2026-06-05', '2026-06-10', '组件热斑专项巡检：红外检测、EL测试、接线盒检查', '阴', '22℃', '["热斑检测报告_003.pdf","红外照片_003.jpg","EL测试截图_003.png"]', 5, 3, 7, '巡检材料完整，发现5处热斑待消缺', NULL, NULL, 1, 'overdue', '2026-06-05 07:45:00', '2026-06-05 09:00:00'),
    (4, 'PO202606004', 4, 'closed', 'low', 3, 5, 7, 'inspector', '2026-06-01', '2026-06-05', '日常巡检：组件外观、汇流箱、SCADA数据核对', '晴', '30℃', '["日常巡检表_004.pdf","SCADA截图_004.png"]', 1, 5, 7, '消缺验收通过，区域负责人已收口', '无异常', NULL, 0, 'normal', '2026-06-01 10:00:00', '2026-06-05 16:30:00');

INSERT OR IGNORE INTO defect_reports (id, patrol_order_id, defect_no, location, description, severity, category, reported_at, deadline, status, reporter_id, assignee_id, evidence, anomaly_reason, version, created_at, updated_at) VALUES
    (1, 1, 'DF202606001', '1号方阵A区12号组件', '组件玻璃裂纹约5cm，疑似冰雹撞击', 'major', '组件损伤', '2026-06-10 09:15:00', '2026-06-17', 'reported', 2, NULL, '["裂纹照片_1.jpg","定位图_1.png"]', NULL, 1, '2026-06-10 09:15:00', '2026-06-10 09:15:00'),
    (2, 1, 'DF202606002', '2号逆变器室', '逆变器A相温度过高，报警阈值85℃时达88℃', 'critical', '逆变器异常', '2026-06-10 09:45:00', '2026-06-13', 'reported', 2, NULL, '["温度曲线_2.png","设备铭牌_2.jpg"]', NULL, 1, '2026-06-10 09:45:00', '2026-06-10 09:45:00'),
    (3, 2, 'DF202606003', '3号方阵电缆沟', '电缆沟积水约15cm，排水口堵塞', 'major', '排水系统', '2026-06-08 14:20:00', '2026-06-14', 'in_progress', 2, 4, '["积水照片_3.jpg","排水口堵塞_3.jpg"]', NULL, 2, '2026-06-08 14:20:00', '2026-06-09 11:00:00'),
    (4, 2, 'DF202606004', '1号箱变', '箱变门密封条老化，雨天有渗水痕迹', 'minor', '箱变密封', '2026-06-08 15:00:00', '2026-06-20', 'reported', 2, NULL, '["渗水痕迹_4.jpg"]', '初次上报时未附照片，已补正', 2, '2026-06-08 15:00:00', '2026-06-09 10:00:00'),
    (5, 2, 'DF202606005', '4号方阵B区8号组件', '组件热斑温度达72℃', 'critical', '热斑', '2026-06-08 16:30:00', '2026-06-11', 'in_progress', 2, 4, '["红外热像图_5.jpg","组件定位_5.png"]', '上报超时，距巡检完成超过24小时', 1, '2026-06-08 16:30:00', '2026-06-09 18:00:00'),
    (6, 3, 'DF202606006', '2号方阵C区15号组件', 'EL检测发现隐裂，面积约1/8电池片', 'major', '隐裂', '2026-06-05 10:30:00', '2026-06-12', 'in_progress', 3, 5, '["EL测试图_6.jpg"]', NULL, 1, '2026-06-05 10:30:00', '2026-06-07 09:00:00'),
    (7, 3, 'DF202606007', '3号方阵D区22号组件', '热斑温度85℃，疑似旁路二极管失效', 'critical', '热斑', '2026-06-05 11:00:00', '2026-06-08', 'in_progress', 3, 5, '["热斑红外图_7.jpg"]', '消缺时限逾期1天', 1, '2026-06-05 11:00:00', '2026-06-07 14:00:00'),
    (8, 3, 'DF202606008', '1号汇流箱', '汇流箱第4路熔断器熔断', 'minor', '电气故障', '2026-06-05 11:45:00', '2026-06-15', 'in_progress', 3, 5, '["熔断器照片_8.jpg"]', NULL, 1, '2026-06-05 11:45:00', '2026-06-07 10:00:00'),
    (9, 3, 'DF202606009', '5号方阵A区3号组件', '接线盒烧毁，有焦糊痕迹', 'critical', '接线盒故障', '2026-06-05 13:20:00', '2026-06-07', 'in_progress', 3, 5, '["烧毁接线盒_9.jpg"]', '消缺时限逾期2天', 1, '2026-06-05 13:20:00', '2026-06-07 16:00:00'),
    (10, 3, 'DF202606010', '4号方阵E区30号组件', 'EL检测隐裂，面积约1/4电池片', 'major', '隐裂', '2026-06-05 14:00:00', '2026-06-12', 'in_progress', 3, 5, '["EL测试图_10.jpg"]', NULL, 1, '2026-06-05 14:00:00', '2026-06-06 11:00:00'),
    (11, 4, 'DF202606011', '2号方阵B区5号组件', '组件表面鸟粪覆盖，面积约5%', 'minor', '脏污', '2026-06-01 11:30:00', '2026-06-04', 'verified', 3, 5, '["脏污照片_11.jpg","清洗后照片_11.jpg"]', NULL, 2, '2026-06-01 11:30:00', '2026-06-05 15:00:00');

INSERT OR IGNORE INTO acceptance_records (id, defect_id, patrol_order_id, result, evidence, remark, acceptor_id, accepted_at, anomaly_reason) VALUES
    (1, 11, 4, 'pass', '["清洗验收照片_11.jpg"]', '组件清洗干净，透光率正常', 7, '2026-06-04 15:30:00', NULL);

INSERT OR IGNORE INTO attachments (id, patrol_order_id, defect_id, file_name, file_path, file_size, file_type, uploaded_by, created_at) VALUES
    (1, 1, NULL, '巡检记录表_001.pdf', '/uploads/PO202606001/巡检记录表_001.pdf', 245760, 'application/pdf', 2, '2026-06-10 08:45:00'),
    (2, 1, NULL, '组件照片_001.jpg', '/uploads/PO202606001/组件照片_001.jpg', 1048576, 'image/jpeg', 2, '2026-06-10 08:46:00'),
    (3, 2, NULL, '雨季巡检记录表_002.pdf', '/uploads/PO202606002/雨季巡检记录表_002.pdf', 327680, 'application/pdf', 2, '2026-06-08 10:30:00'),
    (4, NULL, 3, '积水照片_3.jpg', '/uploads/DF202606003/积水照片_3.jpg', 2097152, 'image/jpeg', 2, '2026-06-08 14:25:00'),
    (5, 4, NULL, '日常巡检表_004.pdf', '/uploads/PO202606004/日常巡检表_004.pdf', 184320, 'application/pdf', 3, '2026-06-01 10:30:00'),
    (6, NULL, 11, '清洗后照片_11.jpg', '/uploads/DF202606011/清洗后照片_11.jpg', 524288, 'image/jpeg', 5, '2026-06-03 14:00:00');

INSERT OR IGNORE INTO audit_trails (id, patrol_order_id, action, from_status, to_status, actor_id, actor_role, remark, anomaly_reason, evidence, previous_opinion, previous_attachment, created_at) VALUES
    (1, 1, '创建巡检单', NULL, 'pending_dispatch', 2, 'inspector', '创建6月华北一号站月度巡检', NULL, NULL, NULL, NULL, '2026-06-10 08:30:00'),
    (2, 2, '创建巡检单', NULL, 'pending_dispatch', 2, 'inspector', '创建雨季专项巡检', NULL, NULL, NULL, NULL, '2026-06-08 09:00:00'),
    (3, 2, '退回补正', 'pending_dispatch', 'returned', 4, 'engineer', '缺少逆变器温度记录，请补充', '巡检材料不全：逆变器温度数据缺失', NULL, NULL, NULL, '2026-06-08 16:00:00'),
    (4, 2, '补正提交', 'returned', 'in_progress', 2, 'inspector', '已补充逆变器温度数据及照片', NULL, '["逆变器温度曲线补充.png"]', '缺少逆变器温度记录，请补充', '/uploads/PO202606002/雨季巡检记录表_002.pdf', '2026-06-09 10:15:00'),
    (5, 2, '派发工程师', 'in_progress', 'in_progress', 6, 'manager', '派发王强工程师处理消缺', NULL, NULL, '材料已补齐，缺陷已录入，请工程师办理消缺', NULL, '2026-06-09 11:00:00'),
    (6, 3, '创建巡检单', NULL, 'pending_dispatch', 3, 'inspector', '创建热斑专项巡检', NULL, NULL, NULL, NULL, '2026-06-05 07:45:00'),
    (7, 3, '提交巡检材料', 'pending_dispatch', 'in_progress', 3, 'inspector', '巡检材料已提交', NULL, '["热斑检测报告_003.pdf","红外照片_003.jpg","EL测试截图_003.png"]', NULL, NULL, '2026-06-05 08:30:00'),
    (8, 3, '派发工程师', 'in_progress', 'in_progress', 7, 'manager', '派发赵敏工程师处理', NULL, NULL, '巡检材料完整，发现5处热斑待消缺', NULL, '2026-06-05 09:00:00'),
    (9, 3, '逾期标记', 'in_progress', 'in_progress', 1, 'admin', '系统检测到消缺时限逾期', 'DF202606007逾期1天，DF202606009逾期2天', NULL, NULL, NULL, '2026-06-10 18:00:00'),
    (10, 4, '创建巡检单', NULL, 'pending_dispatch', 3, 'inspector', '创建日常巡检', NULL, NULL, NULL, NULL, '2026-06-01 10:00:00'),
    (11, 4, '提交巡检材料', 'pending_dispatch', 'in_progress', 3, 'inspector', '日常巡检材料完整', NULL, '["日常巡检表_004.pdf","SCADA截图_004.png"]', NULL, NULL, '2026-06-01 10:30:00'),
    (12, 4, '派发工程师', 'in_progress', 'in_progress', 7, 'manager', '派发赵敏处理', NULL, NULL, NULL, NULL, '2026-06-01 11:00:00'),
    (13, 4, '消缺完成', 'in_progress', 'reviewing', 5, 'engineer', '组件脏污已清洗完成', NULL, '["清洗后照片_11.jpg"]', NULL, NULL, '2026-06-03 16:00:00'),
    (14, 4, '复核通过', 'reviewing', 'closed', 7, 'manager', '验收通过，巡检单关闭', NULL, NULL, '消缺完成，组件清洗干净', '/uploads/DF202606011/清洗后照片_11.jpg', '2026-06-05 16:30:00');

INSERT OR IGNORE INTO process_records (id, patrol_order_id, step_order, step_name, handler_id, handler_role, status, opinion, evidence, started_at, finished_at, anomaly_reason, correction_note, created_at) VALUES
    (1, 1, 1, '站点巡检员补齐材料', 2, 'inspector', 'in_progress', '正在整理巡检材料', '["巡检记录表_001.pdf"]', '2026-06-10 08:30:00', NULL, NULL, NULL, '2026-06-10 08:30:00'),
    (2, 1, 2, '运维工程师办理', NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-10 08:30:00'),
    (3, 1, 3, '区域负责人收口', NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-10 08:30:00'),
    (4, 2, 1, '站点巡检员补齐材料', 2, 'inspector', 'completed', '巡检材料已提交，含3处缺陷上报', '["雨季巡检记录表_002.pdf","排水系统照片_002.jpg","逆变器温度曲线补充.png"]', '2026-06-08 09:00:00', '2026-06-09 10:15:00', '初次提交缺少逆变器温度数据', '2026-06-09补充逆变器温度记录及截图', '2026-06-08 09:00:00'),
    (5, 2, 2, '运维工程师办理', 4, 'engineer', 'in_progress', '正在处理3处缺陷消缺', NULL, '2026-06-09 11:00:00', NULL, NULL, NULL, '2026-06-09 11:00:00'),
    (6, 2, 3, '区域负责人收口', NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-09 11:00:00'),
    (7, 3, 1, '站点巡检员补齐材料', 3, 'inspector', 'completed', '巡检材料完整，EL测试及红外检测齐全', '["热斑检测报告_003.pdf","红外照片_003.jpg","EL测试截图_003.png"]', '2026-06-05 07:45:00', '2026-06-05 08:30:00', NULL, NULL, '2026-06-05 07:45:00'),
    (8, 3, 2, '运维工程师办理', 5, 'engineer', 'in_progress', '5处缺陷正在处理中', NULL, '2026-06-05 09:00:00', NULL, '2处缺陷消缺逾期', NULL, '2026-06-05 09:00:00'),
    (9, 3, 3, '区域负责人收口', NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-05 09:00:00'),
    (10, 4, 1, '站点巡检员补齐材料', 3, 'inspector', 'completed', '日常巡检材料完整', '["日常巡检表_004.pdf","SCADA截图_004.png"]', '2026-06-01 10:00:00', '2026-06-01 10:30:00', NULL, NULL, '2026-06-01 10:00:00'),
    (11, 4, 2, '运维工程师办理', 5, 'engineer', 'completed', '组件清洗完成，消缺验收通过', '["清洗后照片_11.jpg"]', '2026-06-01 11:00:00', '2026-06-03 16:00:00', NULL, NULL, '2026-06-01 11:00:00'),
    (12, 4, 3, '区域负责人收口', 7, 'manager', 'completed', '复核通过，巡检单关闭', NULL, '2026-06-03 16:30:00', '2026-06-05 16:30:00', NULL, NULL, '2026-06-03 16:30:00');
