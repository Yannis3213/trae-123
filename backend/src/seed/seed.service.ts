import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupOrder } from '../entities/group-order.entity';
import { Attachment } from '../entities/attachment.entity';
import { AuditNote } from '../entities/audit-note.entity';
import { ExceptionReason } from '../entities/exception-reason.entity';
import { ProcessingRecord } from '../entities/processing-record.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { ActionType } from '../common/enums/action-type.enum';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(GroupOrder)
    private groupOrderRepository: Repository<GroupOrder>,
    @InjectRepository(Attachment)
    private attachmentRepository: Repository<Attachment>,
    @InjectRepository(AuditNote)
    private auditNoteRepository: Repository<AuditNote>,
    @InjectRepository(ExceptionReason)
    private exceptionReasonRepository: Repository<ExceptionReason>,
    @InjectRepository(ProcessingRecord)
    private processingRecordRepository: Repository<ProcessingRecord>,
  ) {}

  async onModuleInit() {
    this.logger.log('开始初始化种子数据...');
    const count = await this.groupOrderRepository.count();
    if (count > 0) {
      this.logger.log(`数据库中已有 ${count} 条订单数据，跳过种子初始化`);
      return;
    }
    await this.seedData();
    this.logger.log('种子数据初始化完成');
  }

  private async seedData() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const order1 = await this.createOrder({
      orderNo: 'TG2026061000001',
      productName: '有机蔬菜礼盒',
      sku: 'SKU-VEG-001',
      shelfDate: new Date(),
      grouponPrice: 199.0,
      quantity: 50,
      orderStatus: OrderStatus.PENDING_ASSIGN,
      createdBy: 'registrar01',
      currentHandler: null,
      currentRole: null,
      deadline: tomorrow,
      isMaterialComplete: true,
      isOverdue: false,
      version: 1,
    });
    await this.createAttachments(order1.id, [
      { fileName: '上架凭证01.jpg', fileType: 'image/jpeg', fileUrl: '/uploads/shelf-01.jpg', evidenceType: 'shelf', uploadedBy: 'registrar01' },
    ]);
    await this.createProcessingRecords(order1.id, [
      { actionType: ActionType.CREATE, operator: 'registrar01', operatorRole: UserRole.GROUPON_REGISTRAR, newStatus: OrderStatus.PENDING_ASSIGN, comment: '创建团购订单', version: 1 },
    ]);
    await this.createAuditNotes(order1.id, [
      { content: '订单信息完整，等待派发', author: 'supervisor01', authorRole: UserRole.AUDIT_SUPERVISOR },
    ]);

    const order2 = await this.createOrder({
      orderNo: 'TG2026061000002',
      productName: '进口水果组合',
      sku: 'SKU-FRU-002',
      shelfDate: new Date(),
      grouponPrice: 299.0,
      quantity: 30,
      orderStatus: OrderStatus.PROCESSING,
      createdBy: 'registrar01',
      currentHandler: 'fulfillment01',
      currentRole: UserRole.FULFILLMENT_SPECIALIST,
      deadline: tomorrow,
      isMaterialComplete: true,
      isOverdue: false,
      orderEvidence: '/uploads/order-02.pdf',
      version: 3,
    });
    await this.createAttachments(order2.id, [
      { fileName: '上架凭证02.jpg', fileType: 'image/jpeg', fileUrl: '/uploads/shelf-02.jpg', evidenceType: 'shelf', uploadedBy: 'registrar01' },
      { fileName: '订单凭证02.pdf', fileType: 'application/pdf', fileUrl: '/uploads/order-02.pdf', evidenceType: 'order', uploadedBy: 'fulfillment01' },
    ]);
    await this.createProcessingRecords(order2.id, [
      { actionType: ActionType.CREATE, operator: 'registrar01', operatorRole: UserRole.GROUPON_REGISTRAR, newStatus: OrderStatus.PENDING_ASSIGN, comment: '创建团购订单', version: 1 },
      { actionType: ActionType.ASSIGN, operator: 'supervisor01', operatorRole: UserRole.AUDIT_SUPERVISOR, previousStatus: OrderStatus.PENDING_ASSIGN, newStatus: OrderStatus.PROCESSING, newHandler: 'fulfillment01', comment: '派发给履约专员处理', version: 2 },
      { actionType: ActionType.SUBMIT, operator: 'fulfillment01', operatorRole: UserRole.FULFILLMENT_SPECIALIST, newStatus: OrderStatus.PROCESSING, comment: '已录入订单凭证', version: 3 },
    ]);
    await this.createAuditNotes(order2.id, [
      { content: '履约专员已提交订单凭证', author: 'review01', authorRole: UserRole.REVIEW_LEADER },
    ]);

    const order3 = await this.createOrder({
      orderNo: 'TG2026061000003',
      productName: '精品海鲜大礼包',
      sku: 'SKU-SEA-003',
      shelfDate: new Date(),
      grouponPrice: 599.0,
      quantity: 20,
      orderStatus: OrderStatus.PROCESSING,
      createdBy: 'registrar02',
      currentHandler: 'leader01',
      currentRole: UserRole.LEADER_OPERATOR,
      deadline: tomorrow,
      isMaterialComplete: false,
      isOverdue: false,
      version: 4,
    });
    await this.createAttachments(order3.id, [
      { fileName: '上架凭证03.jpg', fileType: 'image/jpeg', fileUrl: '/uploads/shelf-03.jpg', evidenceType: 'shelf', uploadedBy: 'registrar02' },
    ]);
    await this.createProcessingRecords(order3.id, [
      { actionType: ActionType.CREATE, operator: 'registrar02', operatorRole: UserRole.GROUPON_REGISTRAR, newStatus: OrderStatus.PENDING_ASSIGN, comment: '创建团购订单', version: 1 },
      { actionType: ActionType.ASSIGN, operator: 'supervisor01', operatorRole: UserRole.AUDIT_SUPERVISOR, previousStatus: OrderStatus.PENDING_ASSIGN, newStatus: OrderStatus.PROCESSING, newHandler: 'leader01', comment: '派发至组长审核', version: 2 },
      { actionType: ActionType.RETURN, operator: 'review01', operatorRole: UserRole.REVIEW_LEADER, previousStatus: OrderStatus.PROCESSING, newStatus: OrderStatus.PROCESSING, previousHandler: 'leader01', newHandler: 'leader01', comment: '缺少订单凭证，需补正材料', version: 3 },
      { actionType: ActionType.CORRECT_MATERIALS, operator: 'leader01', operatorRole: UserRole.LEADER_OPERATOR, newStatus: OrderStatus.PROCESSING, comment: '正在补正材料', version: 4 },
    ]);
    await this.createAuditNotes(order3.id, [
      { content: '审核发现材料不完整，已退回补正', author: 'review01', authorRole: UserRole.REVIEW_LEADER },
      { content: '请尽快上传订单凭证', author: 'review01', authorRole: UserRole.REVIEW_LEADER },
    ]);
    await this.createExceptionReasons(order3.id, [
      { reason: '缺少订单凭证，材料不完整', reasonType: 'material_missing', operator: 'review01', needRole: '团长运营' },
    ]);

    const order4 = await this.createOrder({
      orderNo: 'TG2026061000004',
      productName: '高端白酒礼盒',
      sku: 'SKU-LIQ-004',
      shelfDate: new Date(),
      grouponPrice: 888.0,
      quantity: 15,
      orderStatus: OrderStatus.PROCESSING,
      createdBy: 'registrar03',
      currentHandler: 'fulfillment02',
      currentRole: UserRole.FULFILLMENT_SPECIALIST,
      deadline: yesterday,
      isMaterialComplete: true,
      isOverdue: true,
      overdueReason: '超过24小时未完成履约',
      orderEvidence: '/uploads/order-04.pdf',
      version: 3,
    });
    await this.createAttachments(order4.id, [
      { fileName: '上架凭证04.jpg', fileType: 'image/jpeg', fileUrl: '/uploads/shelf-04.jpg', evidenceType: 'shelf', uploadedBy: 'registrar03' },
      { fileName: '订单凭证04.pdf', fileType: 'application/pdf', fileUrl: '/uploads/order-04.pdf', evidenceType: 'order', uploadedBy: 'fulfillment02' },
    ]);
    await this.createProcessingRecords(order4.id, [
      { actionType: ActionType.CREATE, operator: 'registrar03', operatorRole: UserRole.GROUPON_REGISTRAR, newStatus: OrderStatus.PENDING_ASSIGN, comment: '创建团购订单', version: 1 },
      { actionType: ActionType.ASSIGN, operator: 'supervisor02', operatorRole: UserRole.AUDIT_SUPERVISOR, previousStatus: OrderStatus.PENDING_ASSIGN, newStatus: OrderStatus.PROCESSING, newHandler: 'fulfillment02', comment: '派发至履约专员', version: 2 },
      { actionType: ActionType.SUBMIT, operator: 'fulfillment02', operatorRole: UserRole.FULFILLMENT_SPECIALIST, newStatus: OrderStatus.PROCESSING, comment: '已提交订单凭证，但未完成履约签收', version: 3 },
    ]);
    await this.createAuditNotes(order4.id, [
      { content: '订单已逾期，请尽快处理履约签收', author: 'supervisor02', authorRole: UserRole.AUDIT_SUPERVISOR },
    ]);
    await this.createExceptionReasons(order4.id, [
      { reason: '履约处理超时，已超过处理截止日期', reasonType: 'overdue', operator: 'system', needRole: '履约专员' },
    ]);

    const order5 = await this.createOrder({
      orderNo: 'TG2026061000005',
      productName: '有机茶礼套装',
      sku: 'SKU-TEA-005',
      shelfDate: new Date(),
      grouponPrice: 268.0,
      quantity: 40,
      orderStatus: OrderStatus.PROCESSING,
      createdBy: 'registrar01',
      currentHandler: 'fulfillment01',
      currentRole: UserRole.FULFILLMENT_SPECIALIST,
      deadline: tomorrow,
      isMaterialComplete: true,
      isOverdue: false,
      shelfEvidence: '/uploads/shelf-05-v2.jpg',
      orderEvidence: '/uploads/order-05.pdf',
      version: 5,
    });
    await this.createAttachments(order5.id, [
      { fileName: '上架凭证05-v1.jpg', fileType: 'image/jpeg', fileUrl: '/uploads/shelf-05-v1.jpg', evidenceType: 'shelf', uploadedBy: 'registrar01' },
      { fileName: '上架凭证05-v2.jpg', fileType: 'image/jpeg', fileUrl: '/uploads/shelf-05-v2.jpg', evidenceType: 'shelf', uploadedBy: 'registrar01' },
      { fileName: '订单凭证05.pdf', fileType: 'application/pdf', fileUrl: '/uploads/order-05.pdf', evidenceType: 'order', uploadedBy: 'fulfillment01' },
    ]);
    await this.createProcessingRecords(order5.id, [
      { actionType: ActionType.CREATE, operator: 'registrar01', operatorRole: UserRole.GROUPON_REGISTRAR, newStatus: OrderStatus.PENDING_ASSIGN, comment: '创建团购订单', version: 1 },
      { actionType: ActionType.ASSIGN, operator: 'supervisor01', operatorRole: UserRole.AUDIT_SUPERVISOR, previousStatus: OrderStatus.PENDING_ASSIGN, newStatus: OrderStatus.PROCESSING, newHandler: 'fulfillment01', comment: '派发至履约专员', version: 2 },
      { actionType: ActionType.RETURN, operator: 'review01', operatorRole: UserRole.REVIEW_LEADER, previousStatus: OrderStatus.PROCESSING, newStatus: OrderStatus.PROCESSING, previousHandler: 'fulfillment01', newHandler: 'registrar01', comment: '上架凭证信息有误，需重新上传', version: 3 },
      { actionType: ActionType.CORRECT_MATERIALS, operator: 'registrar01', operatorRole: UserRole.GROUPON_REGISTRAR, newStatus: OrderStatus.PROCESSING, comment: '已重新上传上架凭证', version: 4 },
      { actionType: ActionType.ASSIGN, operator: 'supervisor01', operatorRole: UserRole.AUDIT_SUPERVISOR, newStatus: OrderStatus.PROCESSING, newHandler: 'fulfillment01', comment: '重新派发至履约专员', version: 5 },
    ]);
    await this.createAuditNotes(order5.id, [
      { content: '首次提交凭证有误，已退回补正', author: 'review01', authorRole: UserRole.REVIEW_LEADER },
      { content: '重新审核后凭证信息正确', author: 'review01', authorRole: UserRole.REVIEW_LEADER },
    ]);
    await this.createExceptionReasons(order5.id, [
      { reason: '上架凭证与SKU信息冲突，凭证内容有误', reasonType: 'conflict', operator: 'review01', needRole: '团购登记员' },
    ]);

    this.logger.log(`共创建 ${[order1, order2, order3, order4, order5].length} 条演示订单`);
  }

  private async createOrder(data: Partial<GroupOrder>): Promise<GroupOrder> {
    const order = this.groupOrderRepository.create({
      ...data,
      totalAmount: data.grouponPrice * data.quantity,
    });
    return await this.groupOrderRepository.save(order);
  }

  private async createAttachments(orderId: number, attachments: Array<Partial<Attachment>>) {
    for (const att of attachments) {
      const attachment = this.attachmentRepository.create({
        ...att,
        orderId,
      });
      await this.attachmentRepository.save(attachment);
    }
  }

  private async createProcessingRecords(orderId: number, records: Array<Partial<ProcessingRecord>>) {
    for (const rec of records) {
      const record = this.processingRecordRepository.create({
        ...rec,
        orderId,
      });
      await this.processingRecordRepository.save(record);
    }
  }

  private async createAuditNotes(orderId: number, notes: Array<Partial<AuditNote>>) {
    for (const note of notes) {
      const auditNote = this.auditNoteRepository.create({
        ...note,
        orderId,
      });
      await this.auditNoteRepository.save(auditNote);
    }
  }

  private async createExceptionReasons(orderId: number, reasons: Array<Partial<ExceptionReason>>) {
    for (const r of reasons) {
      const reason = this.exceptionReasonRepository.create({
        ...r,
        orderId,
      });
      await this.exceptionReasonRepository.save(reason);
    }
  }
}
