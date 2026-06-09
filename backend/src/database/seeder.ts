import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TreatmentPlan } from '../entities/treatment-plan.entity';
import { Attachment } from '../entities/attachment.entity';
import { ProcessRecord } from '../entities/process-record.entity';
import { AuditNote } from '../entities/audit-note.entity';
import { ExceptionCause } from '../entities/exception-cause.entity';

interface SeedRepos {
  userRepo: Repository<User>;
  planRepo: Repository<TreatmentPlan>;
  attRepo: Repository<Attachment>;
  recordRepo: Repository<ProcessRecord>;
  noteRepo: Repository<AuditNote>;
  causeRepo: Repository<ExceptionCause>;
}

export async function runSeed(repos: SeedRepos) {
  const { userRepo, planRepo, attRepo, recordRepo, noteRepo, causeRepo } = repos;

  const userCount = await userRepo.count();
  if (userCount > 0) {
    return;
  }

  const consultant = userRepo.create({
    username: 'consultant1',
    password: '123456',
    role: 'consultant',
    name: '李顾问',
  });
  const doctor = userRepo.create({
    username: 'doctor1',
    password: '123456',
    role: 'doctor',
    name: '张医生',
  });
  const dean = userRepo.create({
    username: 'dean1',
    password: '123456',
    role: 'dean',
    name: '王院长',
  });

  await userRepo.save([consultant, doctor, dean]);

  const now = new Date();

  // TP202606001 正常流转：状态待复查
  const plan1 = planRepo.create({
    patientName: '陈小明',
    patientIdCard: '310101199001011234',
    patientPhone: '13800000001',
    planNo: 'TP202606001',
    status: 'pending_review',
    version: 3,
    currentHandler: dean.id,
    doctorId: doctor.id,
    consultantId: consultant.id,
    deanId: null,
    deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    lastHandlerRemark: '已完成治疗方案确认，请院长复查',
    materialsComplete: true,
    planComplete: true,
    reminderComplete: true,
  });

  // TP202606002 缺材料异常：状态异常
  const plan2 = planRepo.create({
    patientName: '王美丽',
    patientIdCard: '310101199202022345',
    patientPhone: '13800000002',
    planNo: 'TP202606002',
    status: 'exception',
    version: 2,
    currentHandler: doctor.id,
    doctorId: doctor.id,
    consultantId: consultant.id,
    deanId: null,
    deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
    lastHandlerRemark: '缺种植体材料，需供应商补充',
    materialsComplete: false,
    planComplete: true,
    reminderComplete: false,
  });

  // TP202606003 超时逾期：状态待确认，deadline已过期
  const plan3 = planRepo.create({
    patientName: '刘大伟',
    patientIdCard: '310101198503033456',
    patientPhone: '13800000003',
    planNo: 'TP202606003',
    status: 'pending_confirm',
    version: 1,
    currentHandler: consultant.id,
    doctorId: null,
    consultantId: null,
    deanId: null,
    deadline: new Date('2026-06-01'),
    lastHandlerRemark: null,
    materialsComplete: false,
    planComplete: false,
    reminderComplete: false,
  });

  // TP202606004 退回补正状态冲突：状态异常
  const plan4 = planRepo.create({
    patientName: '赵思远',
    patientIdCard: '310101199104044567',
    patientPhone: '13800000004',
    planNo: 'TP202606004',
    status: 'exception',
    version: 2,
    currentHandler: doctor.id,
    doctorId: doctor.id,
    consultantId: consultant.id,
    deanId: null,
    deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
    lastHandlerRemark: '治疗方案与影像资料不匹配，需重新核对',
    materialsComplete: true,
    planComplete: false,
    reminderComplete: false,
  });

  await planRepo.save([plan1, plan2, plan3, plan4]);

  // Plan 1 历史记录
  const r1a = recordRepo.create({
    planId: plan1.id,
    userId: consultant.id,
    action: 'confirm',
    fromStatus: 'pending_confirm',
    toStatus: 'confirmed',
    remark: '患者信息核对无误，已确认',
    evidence: null,
  });
  const r1b = recordRepo.create({
    planId: plan1.id,
    userId: doctor.id,
    action: 'submit_review',
    fromStatus: 'confirmed',
    toStatus: 'pending_review',
    remark: '治疗方案已完成，患者已复诊提醒',
    evidence: '已通过电话完成复诊提醒，患者确认时间',
  });
  await recordRepo.save([r1a, r1b]);

  // Plan 2 附件 + 异常原因 + 记录
  const att2 = attRepo.create({
    planId: plan2.id,
    type: 'patient',
    filename: 'material_checklist.pdf',
    url: '/uploads/material_checklist.pdf',
    uploadedBy: doctor.id,
  });
  await attRepo.save(att2);

  const cause2 = causeRepo.create({
    planId: plan2.id,
    type: 'material',
    description: '缺少种植体材料（型号 Straumann BLX 4.1x10mm），供应商预计3天后到货',
    reportedBy: doctor.id,
    resolved: false,
  });
  await causeRepo.save(cause2);

  const r2a = recordRepo.create({
    planId: plan2.id,
    userId: consultant.id,
    action: 'confirm',
    fromStatus: 'pending_confirm',
    toStatus: 'confirmed',
    remark: '患者信息确认完成',
    evidence: null,
  });
  const r2b = recordRepo.create({
    planId: plan2.id,
    userId: doctor.id,
    action: 'mark_exception',
    fromStatus: 'confirmed',
    toStatus: 'exception',
    remark: '材料缺失，标记异常',
    evidence: '详见附件材料清单',
  });
  await recordRepo.save([r2a, r2b]);

  // Plan 4 异常原因 + 退回记录 + 审计备注
  const cause4 = causeRepo.create({
    planId: plan4.id,
    type: 'status',
    description: '院长复查时发现治疗方案与CBCT影像数据不匹配，退回医生重新调整',
    reportedBy: dean.id,
    resolved: false,
  });
  await causeRepo.save(cause4);

  const note4 = noteRepo.create({
    planId: plan4.id,
    userId: dean.id,
    note: '审计备注：治疗方案编号与影像系统编号不一致，建议核对后重新提交。',
  });
  await noteRepo.save(note4);

  const r4a = recordRepo.create({
    planId: plan4.id,
    userId: consultant.id,
    action: 'confirm',
    fromStatus: 'pending_confirm',
    toStatus: 'confirmed',
    remark: '患者资料已核实',
    evidence: null,
  });
  const r4b = recordRepo.create({
    planId: plan4.id,
    userId: doctor.id,
    action: 'submit_review',
    fromStatus: 'confirmed',
    toStatus: 'pending_review',
    remark: '初次提交治疗方案',
    evidence: null,
  });
  await recordRepo.save([r4a, r4b]);

  console.log('[Seed] 数据初始化完成');
}
