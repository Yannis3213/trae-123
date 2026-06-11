const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const initDatabase = require('./initDb');
const db = require('../db');
const { ROLES, STATUS } = require('../config');
const { v4: uuidv4 } = require('uuid');

function seedData() {
  initDatabase();

  const clearTables = [
    'abnormal_reasons', 'audit_notes', 'process_records', 'attachments', 'side_records', 'users'
  ];
  for (const table of clearTables) {
    db.exec(`DELETE FROM ${table}`);
  }
  console.log('已清空旧数据');

  const users = [
    {
      id: uuidv4(),
      username: 'jianliyuan',
      password: bcrypt.hashSync('123456', 10),
      name: '张监理',
      role: ROLES.REGISTRAR,
      department: '监理一部',
      phone: '13800000001'
    },
    {
      id: uuidv4(),
      username: 'zhuanyejianli',
      password: bcrypt.hashSync('123456', 10),
      name: '李工（专业监理）',
      role: ROLES.SUPERVISOR,
      department: '监理技术部',
      phone: '13800000002'
    },
    {
      id: uuidv4(),
      username: 'zongjiandaibiao',
      password: bcrypt.hashSync('123456', 10),
      name: '王总监代表',
      role: ROLES.REVIEWER,
      department: '监理公司总部',
      phone: '13800000003'
    }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, name, role, department, phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);
  for (const u of users) {
    insertUser.run(u.id, u.username, u.password, u.name, u.role, u.department, u.phone);
  }
  console.log(`已创建 ${users.length} 个用户账号`);

  const registrarId = users[0].id;
  const supervisorId = users[1].id;
  const reviewerId = users[2].id;

  const records = [
    {
      status: STATUS.SYNCED,
      sampleType: 'normal',
      sampleName: '【正常流转样例】地下车库主体混凝土浇筑',
      projectName: '阳光花园小区项目',
      projectCode: 'YG-2024-001',
      location: 'A区地下车库负二层',
      workContent: '主体结构C30混凝土浇筑旁站',
      sideRecordClue: 'PZCL-YG-001',
      weather: '晴',
      recordDate: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().add(2, 'day').format('YYYY-MM-DD'),
      sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片+混凝土浇筑',
      inspectionRecord: '混凝土坍落度、和易性符合要求，振捣密实，养护措施到位',
      signatures: '施工方签字：陈工；监理方签字：张监理',
      registrarId,
      currentHandlerId: null,
      reviewerId: supervisorId,
      finalArchiverId: reviewerId,
      problemNoticeStatus: '无',
      rectificationReviewStatus: '合格',
      warningGroup: 'normal',
      version: 4
    },
    {
      status: STATUS.MATERIAL_MISSING,
      sampleType: 'missing',
      sampleName: '【缺料样例】钢筋绑扎工程旁站',
      projectName: '阳光花园小区项目',
      projectCode: 'YG-2024-001',
      location: 'B区3号楼5层',
      workContent: '梁板钢筋绑扎旁站监理',
      sideRecordClue: 'PZCL-YG-002',
      weather: '多云',
      recordDate: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().add(5, 'day').format('YYYY-MM-DD'),
      sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片+钢筋绑扎',
      inspectionRecord: '',
      signatures: '',
      registrarId,
      currentHandlerId: registrarId,
      reviewerId: supervisorId,
      finalArchiverId: null,
      problemNoticeStatus: '已发整改通知',
      rectificationReviewStatus: '待整改',
      abnormalType: 'missing',
      abnormalReason: '缺少检查记录和签字证据，需补充钢筋间距检测记录、隐蔽验收签字',
      warningGroup: 'normal',
      version: 2
    },
    {
      status: STATUS.OVERDUE,
      sampleType: 'overdue',
      sampleName: '【逾期样例】防水工程旁站',
      projectName: '滨江商业综合体项目',
      projectCode: 'BJ-2024-008',
      location: '地下室外墙SBS防水',
      workContent: '地下室底板SBS改性沥青防水卷材施工旁站',
      sideRecordClue: 'PZCL-BJ-015',
      weather: '阴',
      recordDate: dayjs().subtract(15, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
      sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片+防水施工',
      inspectionRecord: '基层处理不到位，阴阳角加强层未做，搭接长度不足',
      signatures: '施工方签字：刘工',
      registrarId,
      currentHandlerId: supervisorId,
      reviewerId: supervisorId,
      finalArchiverId: null,
      problemNoticeStatus: '问题已通知',
      rectificationReviewStatus: '待复核',
      abnormalType: 'overdue',
      abnormalReason: '超出整改期限3天仍未完成复核，防水施工队人员组织不到位',
      warningGroup: 'overdue',
      version: 3
    },
    {
      status: STATUS.RETURNED,
      sampleType: 'returned',
      sampleName: '【退回补正样例】模板安装旁站',
      projectName: '滨江商业综合体项目',
      projectCode: 'BJ-2024-008',
      location: '商业裙房2层柱模板',
      workContent: '框架柱模板安装旁站监理',
      sideRecordClue: 'PZCL-BJ-016',
      weather: '小雨',
      recordDate: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片+模板安装',
      inspectionRecord: '模板垂直度偏差超过规范允许值，支撑体系间距偏大',
      signatures: '施工方签字：赵工',
      registrarId,
      currentHandlerId: registrarId,
      reviewerId: supervisorId,
      finalArchiverId: null,
      problemNoticeStatus: '整改通知已签发',
      rectificationReviewStatus: '退回补正',
      abnormalType: 'return',
      abnormalReason: '模板垂直度、平整度检测数据填写不规范，未附实测数据照片，退回补正',
      warningGroup: 'approaching',
      version: 2
    },
    {
      status: STATUS.STATUS_CONFLICT,
      sampleType: 'conflict',
      sampleName: '【状态冲突样例】砌体工程旁站',
      projectName: '阳光花园小区项目',
      projectCode: 'YG-2024-001',
      location: 'C区2号楼3层砌体',
      workContent: '加气混凝土砌块砌筑旁站',
      sideRecordClue: 'PZCL-YG-003',
      weather: '晴',
      recordDate: dayjs().subtract(4, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片+砌体施工',
      inspectionRecord: '灰缝厚度不均匀，局部出现通缝',
      signatures: '施工方签字：孙工；监理方签字：张监理',
      registrarId,
      currentHandlerId: supervisorId,
      reviewerId: supervisorId,
      finalArchiverId: null,
      problemNoticeStatus: '正在协调',
      rectificationReviewStatus: '状态冲突',
      abnormalType: 'conflict',
      abnormalReason: '施工方与监理方对整改标准存在分歧，需专题会议协调',
      warningGroup: 'approaching',
      version: 3
    },
    {
      status: STATUS.PENDING_REVIEW,
      sampleType: 'pending',
      sampleName: '【待审核样例】脚手架搭设旁站',
      projectName: '滨江商业综合体项目',
      projectCode: 'BJ-2024-008',
      location: '主楼外脚手架',
      workContent: '落地式双排扣件钢管脚手架搭设旁站',
      sideRecordClue: 'PZCL-BJ-017',
      weather: '晴',
      recordDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().add(7, 'day').format('YYYY-MM-DD'),
      sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片+脚手架搭设',
      inspectionRecord: '立杆间距、步距符合方案要求，连墙件设置到位',
      signatures: '施工方签字：周工；监理方签字：张监理',
      registrarId,
      currentHandlerId: supervisorId,
      reviewerId: null,
      finalArchiverId: null,
      problemNoticeStatus: '无',
      rectificationReviewStatus: '待审核',
      warningGroup: 'normal',
      version: 1
    },
    {
      status: STATUS.REVIEW_PASSED,
      sampleType: 'reviewed',
      sampleName: '【审核通过待归档样例】基坑支护旁站',
      projectName: '科技创新大厦项目',
      projectCode: 'KJ-2024-012',
      location: '基坑东侧支护桩',
      workContent: '钻孔灌注桩浇筑旁站监理',
      sideRecordClue: 'PZCL-KJ-007',
      weather: '晴',
      recordDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
      deadline: dayjs().add(3, 'day').format('YYYY-MM-DD'),
      sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片+钻孔灌注桩',
      inspectionRecord: '桩径、桩长满足设计要求，混凝土浇筑连续，导管埋深控制在2-6m',
      signatures: '施工方签字：吴工；监理方签字：张监理；见证签字：李工',
      registrarId,
      currentHandlerId: reviewerId,
      reviewerId: supervisorId,
      finalArchiverId: null,
      problemNoticeStatus: '无',
      rectificationReviewStatus: '合格',
      warningGroup: 'normal',
      version: 2
    }
  ];

  const insertRecord = db.prepare(`
    INSERT INTO side_records (
      id, record_no, project_name, project_code, location, work_content,
      side_record_clue, weather, record_date, deadline,
      site_photo, inspection_record, signatures,
      status, version, registrar_id, current_handler_id,
      reviewer_id, final_archiver_id,
      problem_notice_status, rectification_review_status,
      abnormal_reason, abnormal_type, warning_group, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);

  const insertProcess = db.prepare(`
    INSERT INTO process_records (
      id, side_record_id, action, from_status, to_status,
      operator_id, handler_id, evidence_submitted, evidence_missing,
      abnormal_reason, abnormal_type, remark, version, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);

  const insertAbnormal = db.prepare(`
    INSERT INTO abnormal_reasons (
      id, side_record_id, reason_type, reason_detail, related_field, reported_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);

  const recordCounter = { count: 0 };

  for (const r of records) {
    const id = uuidv4();
    const recordNo = generateRecordNo(recordCounter);
    insertRecord.run(
      id, recordNo, r.projectName, r.projectCode, r.location, r.workContent,
      r.sideRecordClue, r.weather, r.recordDate, r.deadline,
      r.sitePhoto, r.inspectionRecord, r.signatures,
      r.status, r.version, r.registrarId, r.currentHandlerId,
      r.reviewerId, r.finalArchiverId,
      r.problemNoticeStatus, r.rectificationReviewStatus,
      r.abnormalReason || null, r.abnormalType || null, r.warningGroup
    );

    insertProcess.run(
      uuidv4(), id, 'create', null, STATUS.PENDING_REVIEW,
      r.registrarId, r.registrarId, null, null, null, null,
      `创建旁站记录单：${r.sampleName}`, 1
    );

    if (r.sampleType === 'normal') {
      insertProcess.run(
        uuidv4(), id, 'submit', STATUS.PENDING_REVIEW, STATUS.PENDING_REVIEW,
        r.registrarId, r.registrarId, JSON.stringify(['sitePhoto', 'inspectionRecord', 'signatures']),
        null, null, null, '提交旁站记录单，证据齐全', 1
      );
      insertProcess.run(
        uuidv4(), id, 'pass', STATUS.PENDING_REVIEW, STATUS.REVIEW_PASSED,
        r.reviewerId, r.reviewerId, JSON.stringify(['sitePhoto', 'inspectionRecord', 'signatures']),
        null, null, null, '审核通过，各项指标符合要求', 2
      );
      insertProcess.run(
        uuidv4(), id, 'sync', STATUS.REVIEW_PASSED, STATUS.SYNCED,
        r.finalArchiverId, null, JSON.stringify(['sitePhoto', 'inspectionRecord', 'signatures']),
        null, null, null, '复核归档完成，已同步至台账', 4
      );
    }

    if (r.sampleType === 'missing') {
      insertProcess.run(
        uuidv4(), id, 'missing', STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING,
        r.reviewerId, r.registrarId, null,
        JSON.stringify(['inspectionRecord', 'signatures']),
        r.abnormalReason, 'missing', '审核发现材料缺失，退回补充', 2
      );
      insertAbnormal.run(
        uuidv4(), id, 'material_missing', r.abnormalReason, 'inspectionRecord,signatures', r.reviewerId
      );
    }

    if (r.sampleType === 'overdue') {
      insertProcess.run(
        uuidv4(), id, 'submit', STATUS.PENDING_REVIEW, STATUS.PENDING_REVIEW,
        r.registrarId, r.registrarId, JSON.stringify(['sitePhoto']), null, null, null, '提交', 1
      );
      insertProcess.run(
        uuidv4(), id, 'overdue', STATUS.PENDING_REVIEW, STATUS.OVERDUE,
        r.reviewerId, r.reviewerId, null, null,
        r.abnormalReason, 'overdue', '整改期限已超，标记为逾期', 3
      );
      insertAbnormal.run(
        uuidv4(), id, 'overdue', r.abnormalReason, 'deadline', r.reviewerId
      );
    }

    if (r.sampleType === 'returned') {
      insertProcess.run(
        uuidv4(), id, 'submit', STATUS.PENDING_REVIEW, STATUS.PENDING_REVIEW,
        r.registrarId, r.registrarId, JSON.stringify(['sitePhoto', 'signatures']), null, null, null, '提交', 1
      );
      insertProcess.run(
        uuidv4(), id, 'return', STATUS.PENDING_REVIEW, STATUS.RETURNED,
        r.reviewerId, r.registrarId, null, null,
        r.abnormalReason, 'return', '数据填写不规范，退回补正', 2
      );
      insertAbnormal.run(
        uuidv4(), id, 'return', r.abnormalReason, 'inspectionRecord', r.reviewerId
      );
    }

    if (r.sampleType === 'conflict') {
      insertProcess.run(
        uuidv4(), id, 'submit', STATUS.PENDING_REVIEW, STATUS.PENDING_REVIEW,
        r.registrarId, r.registrarId, JSON.stringify(['sitePhoto', 'inspectionRecord', 'signatures']), null, null, null, '提交', 1
      );
      insertProcess.run(
        uuidv4(), id, 'conflict', STATUS.PENDING_REVIEW, STATUS.STATUS_CONFLICT,
        r.reviewerId, r.reviewerId, null, null,
        r.abnormalReason, 'conflict', '双方标准存在分歧，需协调', 3
      );
      insertAbnormal.run(
        uuidv4(), id, 'conflict', r.abnormalReason, null, r.reviewerId
      );
    }

    if (r.sampleType === 'reviewed') {
      insertProcess.run(
        uuidv4(), id, 'submit', STATUS.PENDING_REVIEW, STATUS.PENDING_REVIEW,
        r.registrarId, r.registrarId, JSON.stringify(['sitePhoto', 'inspectionRecord', 'signatures']), null, null, null, '提交', 1
      );
      insertProcess.run(
        uuidv4(), id, 'pass', STATUS.PENDING_REVIEW, STATUS.REVIEW_PASSED,
        r.reviewerId, r.finalArchiverId, JSON.stringify(['sitePhoto', 'inspectionRecord', 'signatures']),
        null, null, null, '审核通过，待归档', 2
      );
    }
  }

  console.log(`已创建 ${records.length} 条旁站记录演示数据`);
  console.log(`  - 正常流转样例: 1 条（已归档）`);
  console.log(`  - 缺料样例: 1 条`);
  console.log(`  - 逾期样例: 1 条`);
  console.log(`  - 退回补正样例: 1 条`);
  console.log(`  - 状态冲突样例: 1 条`);
  console.log(`  - 待审核样例: 1 条`);
  console.log(`  - 审核通过待归档样例: 1 条`);
  console.log('');
  console.log('账号信息：');
  console.log(`  旁站记录登记员（监理员）: jianliyuan / 123456`);
  console.log(`  旁站记录审核主管（专业监理工程师）: zhuanyejianli / 123456`);
  console.log(`  工程监理公司复核负责人（总监代表）: zongjiandaibiao / 123456`);
  console.log('');
  console.log('演示数据初始化完成！');
}

function generateRecordNo(counter) {
  counter.count++;
  const prefix = 'PZJL';
  const date = dayjs().format('YYYYMMDD');
  return `${prefix}${date}${String(counter.count).padStart(4, '0')}`;
}

if (require.main === module) {
  seedData();
}

module.exports = seedData;
