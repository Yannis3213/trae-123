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
      exceptionReason: '审核超时未处理',
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
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请' }),
        recordRepo.create({ orderId: order.id, action: 'return', operator: 'u2', operatorRole: 'reviewer', opinion: '缺少支付凭证，请补充后重新提交' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260612001' }),
        auditRepo.create({ orderId: order.id, action: 'return', operator: 'u2', operatorRole: 'reviewer', detail: '退回修改：缺少支付凭证' }),
      );
    }
    if (order.id === 'o2') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请' }),
        recordRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', opinion: '材料齐全，同意上报审批' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260612002' }),
        auditRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', detail: '审核通过，提交审批' }),
      );
    }
    if (order.id === 'o3') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请' }),
        recordRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', opinion: '审核通过' }),
        recordRepo.create({ orderId: order.id, action: 'approve_finalize', operator: 'u3', operatorRole: 'approver', opinion: '审批通过，订单完成' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260610001' }),
        auditRepo.create({ orderId: order.id, action: 'review_approve', operator: 'u2', operatorRole: 'reviewer', detail: '审核通过' }),
        auditRepo.create({ orderId: order.id, action: 'approve_finalize', operator: 'u3', operatorRole: 'approver', detail: '审批完成' }),
      );
    }
    if (order.id === 'o4') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260612003' }),
      );
    }
    if (order.id === 'o5') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请' }),
        recordRepo.create({ orderId: order.id, action: 'overdue', operator: 'system', operatorRole: 'system', opinion: '审核超时，订单标记为逾期' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260608001' }),
        auditRepo.create({ orderId: order.id, action: 'overdue', operator: 'system', operatorRole: 'system', detail: '订单逾期' }),
      );
    }
    if (order.id === 'o6') {
      records.push(
        recordRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', opinion: '提交场地预约申请' }),
      );
      audits.push(
        auditRepo.create({ orderId: order.id, action: 'create', operator: 'u1', operatorRole: 'registrar', detail: '创建订单 VD20260611001' }),
      );
    }
  }

  await recordRepo.save(records);
  await auditRepo.save(audits);

  console.log('Seed data inserted successfully');
}
