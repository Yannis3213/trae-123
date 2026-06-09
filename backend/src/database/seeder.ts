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
    deadline: new Date('2026-06-04'),
    lastHandlerRemark: null,
    materialsComplete: false,
    planComplete: false,
    reminderComplete: false,
  });

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

  const att1_1 = attRepo.create({
    planId: plan1.id,
    type: 'patient',
    filename: 'patient_id_card.jpg',
    url: '/uploads/patient_id_card_001.jpg',
    uploadedBy: consultant.id,
  });
  const att1_2 = attRepo.create({
    planId: plan1.id,
    type: 'patient',
    filename: 'medical_history.pdf',
    url: '/uploads/medical_history_001.pdf',
    uploadedBy: consultant.id,
  });
  const att1_3 = attRepo.create({
    planId: plan1.id,
    type: 'plan',
    filename: 'treatment_plan_v1.pdf',
    url: '/uploads/treatment_plan_001_v1.pdf',
    uploadedBy: doctor.id,
  });
  const att1_4 = attRepo.create({
    planId: plan1.id,
    type: 'plan',
    filename: 'cbct_scan.dcm',
    url: '/uploads/cbct_001.dcm',
    uploadedBy: doctor.id,
  });
  const att1_5 = attRepo.create({
    planId: plan1.id,
    type: 'reminder',
    filename: 'follow_up_sms.png',
    url: '/uploads/follow_up_sms_001.png',
    uploadedBy: doctor.id,
  });
  const att1_6 = attRepo.create({
    planId: plan1.id,
    type: 'reminder',
    filename: 'call_record.pdf',
    url: '/uploads/call_record_001.pdf',
    uploadedBy: doctor.id,
  });
  await attRepo.save([att1_1, att1_2, att1_3, att1_4, att1_5, att1_6]);

  const att2_1 = attRepo.create({
    planId: plan2.id,
    type: 'patient',
    filename: 'patient_id_card.jpg',
    url: '/uploads/patient_id_card_002.jpg',
    uploadedBy: consultant.id,
  });
  const att2_2 = attRepo.create({
    planId: plan2.id,
    type: 'patient',
    filename: 'oral_exam.pdf',
    url: '/uploads/oral_exam_002.pdf',
    uploadedBy: consultant.id,
  });
  const att2_3 = attRepo.create({
    planId: plan2.id,
    type: 'plan',
    filename: 'treatment_plan_v1.pdf',
    url: '/uploads/treatment_plan_002_v1.pdf',
    uploadedBy: doctor.id,
  });
  const att2_4 = attRepo.create({
    planId: plan2.id,
    type: 'plan',
    filename: 'material_checklist.pdf',
    url: '/uploads/material_checklist_002.pdf',
    uploadedBy: doctor.id,
  });
  const att2_5 = attRepo.create({
    planId: plan2.id,
    type: 'reminder',
    filename: 'pre_treatment_notice.pdf',
    url: '/uploads/pre_treatment_notice_002.pdf',
    uploadedBy: doctor.id,
  });
  const att2_6 = attRepo.create({
    planId: plan2.id,
    type: 'reminder',
    filename: 'sms_reminder.png',
    url: '/uploads/sms_reminder_002.png',
    uploadedBy: doctor.id,
  });
  await attRepo.save([att2_1, att2_2, att2_3, att2_4, att2_5, att2_6]);

  const att3_1 = attRepo.create({
    planId: plan3.id,
    type: 'patient',
    filename: 'patient_id_card.jpg',
    url: '/uploads/patient_id_card_003.jpg',
    uploadedBy: consultant.id,
  });
  const att3_2 = attRepo.create({
    planId: plan3.id,
    type: 'patient',
    filename: 'registration_form.pdf',
    url: '/uploads/registration_form_003.pdf',
    uploadedBy: consultant.id,
  });
  const att3_3 = attRepo.create({
    planId: plan3.id,
    type: 'plan',
    filename: 'preliminary_diagnosis.pdf',
    url: '/uploads/preliminary_diagnosis_003.pdf',
    uploadedBy: consultant.id,
  });
  const att3_4 = attRepo.create({
    planId: plan3.id,
    type: 'plan',
    filename: 'x_ray.jpg',
    url: '/uploads/x_ray_003.jpg',
    uploadedBy: consultant.id,
  });
  const att3_5 = attRepo.create({
    planId: plan3.id,
    type: 'reminder',
    filename: 'appointment_reminder.png',
    url: '/uploads/appointment_reminder_003.png',
    uploadedBy: consultant.id,
  });
  const att3_6 = attRepo.create({
    planId: plan3.id,
    type: 'reminder',
    filename: 'wechat_reminder.jpg',
    url: '/uploads/wechat_reminder_003.jpg',
    uploadedBy: consultant.id,
  });
  await attRepo.save([att3_1, att3_2, att3_3, att3_4, att3_5, att3_6]);

  const att4_1 = attRepo.create({
    planId: plan4.id,
    type: 'patient',
    filename: 'patient_id_card.jpg',
    url: '/uploads/patient_id_card_004.jpg',
    uploadedBy: consultant.id,
  });
  const att4_2 = attRepo.create({
    planId: plan4.id,
    type: 'patient',
    filename: 'insurance_card.jpg',
    url: '/uploads/insurance_card_004.jpg',
    uploadedBy: consultant.id,
  });
  const att4_3 = attRepo.create({
    planId: plan4.id,
    type: 'plan',
    filename: 'treatment_plan_v2.pdf',
    url: '/uploads/treatment_plan_004_v2.pdf',
    uploadedBy: doctor.id,
  });
  const att4_4 = attRepo.create({
    planId: plan4.id,
    type: 'plan',
    filename: 'cbct_comparison.pdf',
    url: '/uploads/cbct_comparison_004.pdf',
    uploadedBy: doctor.id,
  });
  const att4_5 = attRepo.create({
    planId: plan4.id,
    type: 'reminder',
    filename: 're_check_notice.pdf',
    url: '/uploads/re_check_notice_004.pdf',
    uploadedBy: doctor.id,
  });
  const att4_6 = attRepo.create({
    planId: plan4.id,
    type: 'reminder',
    filename: 'phone_log.png',
    url: '/uploads/phone_log_004.png',
    uploadedBy: doctor.id,
  });
  await attRepo.save([att4_1, att4_2, att4_3, att4_4, att4_5, att4_6]);

  const r1a = recordRepo.create({
    planId: plan1.id,
    userId: consultant.id,
    action: 'confirm',
    fromStatus: 'pending_confirm',
    toStatus: 'confirmed',
    remark: '患者信息核对无误，身份证、病史资料齐全',
    evidence: '患者身份证正反面照片、既往病史记录已存档',
  });
  const r1b = recordRepo.create({
    planId: plan1.id,
    userId: doctor.id,
    action: 'submit_review',
    fromStatus: 'confirmed',
    toStatus: 'pending_review',
    remark: '治疗方案已完成，患者已复诊提醒',
    evidence: '已通过电话完成复诊提醒，患者确认6月15日复诊，通话录音已存档',
  });
  await recordRepo.save([r1a, r1b]);

  const note1_1 = noteRepo.create({
    planId: plan1.id,
    userId: dean.id,
    note: '患者种植条件良好，骨密度充足，预计治疗周期3-4个月。',
  });
  const note1_2 = noteRepo.create({
    planId: plan1.id,
    userId: doctor.id,
    note: '采用 Straumann BLX 种植体系统，已与患者充分沟通费用及风险。',
  });
  await noteRepo.save([note1_1, note1_2]);

  const cause2 = causeRepo.create({
    planId: plan2.id,
    type: 'material',
    description: '种植体材料清单缺失，未上传签字版治疗知情同意书',
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
    remark: '患者信息确认完成，口腔检查已做',
    evidence: '口腔检查报告、患者身份证已核验',
  });
  const r2b = recordRepo.create({
    planId: plan2.id,
    userId: doctor.id,
    action: 'mark_exception',
    fromStatus: 'confirmed',
    toStatus: 'exception',
    remark: '材料缺失，标记异常',
    evidence: '材料清单显示种植体型号 Straumann BLX 4.1x10mm 缺货，治疗知情同意书未签字',
  });
  await recordRepo.save([r2a, r2b]);

  const note2_1 = noteRepo.create({
    planId: plan2.id,
    userId: doctor.id,
    note: '已联系供应商，预计3天后种植体到货，届时第一时间安排补录。',
  });
  const note2_2 = noteRepo.create({
    planId: plan2.id,
    userId: consultant.id,
    note: '已电话通知患者材料延迟情况，患者表示理解并愿意等待。',
  });
  await noteRepo.save([note2_1, note2_2]);

  const cause3 = causeRepo.create({
    planId: plan3.id,
    type: 'timeline',
    description: '患者预约确认超时，已超过原定截止日期5天，需尽快联系患者确认',
    reportedBy: consultant.id,
    resolved: false,
  });
  await causeRepo.save(cause3);

  const note3_1 = noteRepo.create({
    planId: plan3.id,
    userId: consultant.id,
    note: '已通过微信、电话多次联系患者，暂未接通，将继续跟进。',
  });
  await noteRepo.save([note3_1]);

  const cause4_a = causeRepo.create({
    planId: plan4.id,
    type: 'status',
    description: '治疗方案与 CBCT 影像不匹配，退回医生重新评估',
    reportedBy: dean.id,
    resolved: false,
  });
  const cause4_b = causeRepo.create({
    planId: plan4.id,
    type: 'material',
    description: '缺失术前全景X光片，影响方案准确性判断',
    reportedBy: dean.id,
    resolved: false,
  });
  await causeRepo.save([cause4_a, cause4_b]);

  const note4_1 = noteRepo.create({
    planId: plan4.id,
    userId: dean.id,
    note: '审计备注：治疗方案编号与影像系统编号不一致，建议核对后重新提交。',
  });
  const note4_2 = noteRepo.create({
    planId: plan4.id,
    userId: doctor.id,
    note: '已收到退回意见，正在重新核对CBCT影像并补拍X光片，预计2天内重新提交。',
  });
  await noteRepo.save([note4_1, note4_2]);

  const r4a = recordRepo.create({
    planId: plan4.id,
    userId: consultant.id,
    action: 'confirm',
    fromStatus: 'pending_confirm',
    toStatus: 'confirmed',
    remark: '患者资料已核实，医保卡已登记',
    evidence: '患者身份证、医保卡照片已存档',
  });
  const r4b = recordRepo.create({
    planId: plan4.id,
    userId: doctor.id,
    action: 'submit_review',
    fromStatus: 'confirmed',
    toStatus: 'pending_review',
    remark: '初次提交治疗方案',
    evidence: '治疗方案V2版、CBCT影像资料已上传',
  });
  await recordRepo.save([r4a, r4b]);

  console.log('[Seed] 数据初始化完成');
}
