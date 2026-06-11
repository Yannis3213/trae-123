import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { VenueOrder } from './entities/venue-order.entity';
import { ProcessingRecord } from './entities/processing-record.entity';
import { Attachment } from './entities/attachment.entity';
import { AuditLog } from './entities/audit-log.entity';

export async function seedDatabase(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const orderRepo = dataSource.getRepository(VenueOrder);
  const recordRepo = dataSource.getRepository(ProcessingRecord);
  const auditRepo = dataSource.getRepository(AuditLog);

  const userCount = await userRepo.count();
  if (userCount > 0) return;

  const users = await userRepo.save([
    userRepo.create({ id: 'u1', name: 'zhangwei', role: 'registrar', displayName: '张伟' }),
    userRepo.create({ id: 'u2', name: 'liming', role: 'reviewer', displayName: '李明' }),
    userRepo.create({ id: 'u3', name: 'wangfang', role: 'approver', displayName: '王芳' }),
  ]);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const orders = await orderRepo.save([
    orderRepo.create({
      id: 'o1',
      orderNo: 'VD20260612001',
      venueName: '市体育中心',
      courtName: 'A号篮球场',
      reservationDate: '2026-06-15',
      timeSlot: '09:00-11:00',
      applicantName: '赵强',
      applicantPhone: '13800000001',
      status: 'pending_correction',
      version: 2,
      correctReason: '缺少支付凭证',
      returnOpinion: '缺少支付凭证，请补充支付核销信息后重新提交',
      exceptionReason: '支付凭证不全',
      responsibleNode: 'registrar_missing_payment',
      paymentAmount: 200,
      paymentMethod: '微信支付',
      paymentStatus: '待核销',
      paymentVerification: null,
      admissionStatus: '待确认',
      admissionConfirmation: null,
      auditRemark: '订单发起时未同步支付凭证',
      currentHandler: 'u1',
      currentHandlerRole: 'registrar',
      deadline: '2026-06-14',
      warningLevel: 'approaching',
      createdBy: 'u1',
    }),
    orderRepo.create({
      id: 'o2',
      orderNo: 'VD20260612002',
      venueName: '区体育馆',
      courtName: 'B号羽毛球馆',
      reservationDate: '2026-06-16',
      timeSlot: '14:00-16:00',
      applicantName: '钱进',
      applicantPhone: '13800000002',
      status: 'under_approval',
      version: 2,
      correctReason: null,
      returnOpinion: null,
      exceptionReason: null,
      responsibleNode: 'reviewer_approved',
      paymentAmount: 350,
      paymentMethod: '支付宝',
      paymentStatus: '已核销',
      paymentVerification: '订单号XD20260612002 已支付 核销时间 2026-06-12 10:30',
      admissionStatus: '待确认',
      admissionConfirmation: null,
      auditRemark: '支付核销凭证齐全，待复核入场信息',
      currentHandler: 'u3',
      currentHandlerRole: 'approver',
      deadline: '2026-06-18',
      warningLevel: 'normal',
      createdBy: 'u1',
    }),
    orderRepo.create({
      id: 'o3',
      orderNo: 'VD20260610001',
      venueName: '大学体育场',
      courtName: 'C号足球场',
      reservationDate: '2026-06-12',
      timeSlot: '10:00-12:00',
      applicantName: '孙丽',
      applicantPhone: '13800000003',
      status: 'completed',
      version: 3,
      correctReason: null,
      returnOpinion: null,
      exceptionReason: null,
      responsibleNode: 'approver_finalized',
      paymentAmount: 800,
      paymentMethod: '对公转账',
      paymentStatus: '已核销',
      paymentVerification: '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20',
      admissionStatus: '已确认',
      admissionConfirmation: '入场时间 2026-06-12 09:55 确认人 王芳',
      auditRemark: '订单完整归档，支付和入场均已确认',
      currentHandler: '',
      currentHandlerRole: '',
      deadline: '2026-06-10',
      warningLevel: 'normal',
      createdBy: 'u1',
    }),
    orderRepo.create({
      id: 'o4',
      orderNo: 'VD20260612003',
      venueName: '社区活动中心',
      courtName: 'D号乒乓球室',
      reservationDate: '2026-06-17',
      timeSlot: '15:00-17:00',
      applicantName: '周伟',
      applicantPhone: '13800000004',
      status: 'pending_review',
      version: 1,
      correctReason: null,
      returnOpinion: null,
      exceptionReason: null,
      responsibleNode: null,
      paymentAmount: 120,
      paymentMethod: '现金',
      paymentStatus: '已核销',
      paymentVerification: '订单号XD20260612003 已支付 核销时间 2026-06-12 09:15',
      admissionStatus: '待确认',
      admissionConfirmation: null,
      auditRemark: '新增订单，支付已完成，待审核主管审核',
      currentHandler: 'u2',
      currentHandlerRole: 'reviewer',
      deadline: '2026-06-18',
      warningLevel: 'normal',
      createdBy: 'u1',
    }),
    orderRepo.create({
      id: 'o5',
      orderNo: 'VD20260608001',
      venueName: '工人文化宫',
      courtName: 'E号网球场',
      reservationDate: '2026-06-10',
      timeSlot: '08:00-10:00',
      applicantName: '吴刚',
      applicantPhone: '13800000005',
      status: 'overdue',
      version: 1,
      correctReason: null,
      returnOpinion: null,
      exceptionReason: '审核超时未处理，节点责任人：李明（审核主管）',
      responsibleNode: 'reviewer_overdue',
      paymentAmount: 150,
      paymentMethod: '微信支付',
      paymentStatus: '待核销',
      paymentVerification: null,
      admissionStatus: '待确认',
      admissionConfirmation: null,
      auditRemark: '已逾期3天，责任节点为审核主管',
      currentHandler: 'u2',
      currentHandlerRole: 'reviewer',
      deadline: '2026-06-10',
      warningLevel: 'overdue',
      createdBy: 'u1',
    }),
    orderRepo.create({
      id: 'o6',
      orderNo: 'VD20260611001',
      venueName: '青少年活动中心',
      courtName: 'F号游泳馆',
      reservationDate: '2026-06-14',
      timeSlot: '16:00-18:00',
      applicantName: '郑华',
      applicantPhone: '13800000006',
      status: 'under_review',
      version: 1,
      correctReason: null,
      returnOpinion: null,
      exceptionReason: null,
      responsibleNode: null,
      paymentAmount: 180,
      paymentMethod: '会员卡',
      paymentStatus: '已核销',
      paymentVerification: '订单号XD20260611001 已支付 核销时间 2026-06-11 16:45',
      admissionStatus: '待确认',
      admissionConfirmation: null,
      auditRemark: '审核中，支付已确认，待审核主管确认',
      currentHandler: 'u2',
      currentHandlerRole: 'reviewer',
      deadline: '2026-06-14',
      warningLevel: 'approaching',
      createdBy: 'u1',
    }),
  ]);

  const records: ProcessingRecord[] = [];
  const audits: AuditLog[] = [];

  for (const order of orders) {
    if (order.id === 'o1') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请', paymentAmount: 200, paymentMethod: '微信支付', paymentStatus: '待核销', paymentVerification: null, admissionStatus: '待确认', admissionConfirmation: null, exceptionReason: null, responsibleNode: null, auditRemark: '订单发起时未同步支付凭证' }),
        recordRepo.create({ orderId: order.id, action: 'return', operator: 'u2', operatorRole: 'reviewer', opinion: '缺少支付凭证，请补充支付核销信息后重新提交', paymentAmount: 200, paymentMethod: '微信支付', paymentStatus: '待核销', paymentVerification: null, admissionStatus: '待确认', admissionConfirmation: null, correctReason: '缺少支付凭证', returnOpinion: '缺少支付凭证，请补充支付核销信息后重新提交', exceptionReason: '支付凭证不全', responsibleNode: 'reviewer_returned', auditRemark: '退回补正，原因：缺少支付核销凭证' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260612001' }),
        auditRepo.create({ orderId: order.id, action: 'return', operator: 'u2', operatorRole: 'reviewer', detail: '退回修改：缺少支付凭证，需补充支付金额、支付方式、核销记录' }),
      );
    }
    if (order.id === 'o2') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请', paymentAmount: 350, paymentMethod: '支付宝', paymentStatus: '已核销', paymentVerification: '订单号XD20260612002 已支付 核销时间 2026-06-12 10:30', admissionStatus: '待确认', admissionConfirmation: null, exceptionReason: null, responsibleNode: null, auditRemark: '新增订单，支付已完成' }),
        recordRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', opinion: '材料齐全，同意上报审批', paymentAmount: 350, paymentMethod: '支付宝', paymentStatus: '已核销', paymentVerification: '订单号XD20260612002 已支付 核销时间 2026-06-12 10:30', admissionStatus: '待确认', admissionConfirmation: null, returnOpinion: '材料齐全，同意上报审批', exceptionReason: null, responsibleNode: 'reviewer_approved', auditRemark: '审核通过，支付核销凭证齐全' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260612002，支付金额350元' }),
        auditRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', detail: '审核通过，支付已核销，提交复核' }),
      );
    }
    if (order.id === 'o3') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请', paymentAmount: 800, paymentMethod: '对公转账', paymentStatus: '已核销', paymentVerification: '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20', admissionStatus: '待确认', admissionConfirmation: null, exceptionReason: null, responsibleNode: null, auditRemark: '新增订单，支付已完成' }),
        recordRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', opinion: '审核通过，支付凭证齐全', paymentAmount: 800, paymentMethod: '对公转账', paymentStatus: '已核销', paymentVerification: '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20', admissionStatus: '待确认', admissionConfirmation: null, returnOpinion: '审核通过，支付凭证齐全', exceptionReason: null, responsibleNode: 'reviewer_approved', auditRemark: '审核通过，支付核销已确认' }),
        recordRepo.create({ orderId: order.id, action: 'approve_finalize', operator: 'u3', operatorRole: 'approver', opinion: '审批通过，订单完成', paymentAmount: 800, paymentMethod: '对公转账', paymentStatus: '已核销', paymentVerification: '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20', admissionStatus: '已确认', admissionConfirmation: '入场时间 2026-06-12 09:55 确认人 王芳', returnOpinion: '审批通过，订单完成', exceptionReason: null, responsibleNode: 'approver_finalized', auditRemark: '复核通过，入场已确认，订单办结归档' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260610001，场地费800元' }),
        auditRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', detail: '审核通过，支付核销确认' }),
        auditRepo.create({ orderId: order.id, action: 'approve_finalize', operator: 'u3', operatorRole: 'approver', detail: '审批完成，入场确认，订单办结' }),
      );
    }
    if (order.id === 'o4') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请', paymentAmount: 120, paymentMethod: '现金', paymentStatus: '已核销', paymentVerification: '订单号XD20260612003 已支付 核销时间 2026-06-12 09:15', admissionStatus: '待确认', admissionConfirmation: null, exceptionReason: null, responsibleNode: null, auditRemark: '新增订单，支付已完成，待审核主管审核' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260612003，金额120元，已支付' }),
      );
    }
    if (order.id === 'o5') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请', paymentAmount: 150, paymentMethod: '微信支付', paymentStatus: '待核销', paymentVerification: null, admissionStatus: '待确认', admissionConfirmation: null, exceptionReason: null, responsibleNode: null, auditRemark: '订单发起' }),
        recordRepo.create({ orderId: order.id, action: 'overdue', operator: 'system', operatorRole: 'system', opinion: '审核超时，订单标记为逾期', paymentAmount: 150, paymentMethod: '微信支付', paymentStatus: '待核销', paymentVerification: null, admissionStatus: '待确认', admissionConfirmation: null, exceptionReason: '审核超时未处理，节点责任人：李明（审核主管）', responsibleNode: 'reviewer_overdue', auditRemark: '系统自动标记逾期，责任节点：审核主管' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260608001' }),
        auditRepo.create({ orderId: order.id, action: 'overdue', operator: 'system', operatorRole: 'system', detail: '订单已逾期，责任节点：李明（审核主管），逾期3天' }),
      );
    }
    if (order.id === 'o6') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请', paymentAmount: 180, paymentMethod: '会员卡', paymentStatus: '已核销', paymentVerification: '订单号XD20260611001 已支付 核销时间 2026-06-11 16:45', admissionStatus: '待确认', admissionConfirmation: null, exceptionReason: null, responsibleNode: null, auditRemark: '审核中，支付已确认' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260611001，金额180元，已核销' }),
      );
    }
  }

  await recordRepo.save(records);
  await auditRepo.save(audits);

  console.log('Seed data inserted successfully');
}
