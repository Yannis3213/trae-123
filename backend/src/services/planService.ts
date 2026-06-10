import * as planRepo from "../repositories/planRepository.js";
import * as userRepo from "../repositories/userRepository.js";
import type { DispatchPlan, Role, AuditAction, PlanStatus, NoteType, AttachmentCategory } from "../types/index.js";

interface Transition {
  nextStatus: PlanStatus;
  nextRole: Role;
  action: AuditAction;
  allowedRoles: Role[];
  nextHandlerRole: Role;
}

const VALID_TRANSITIONS: Record<string, Transition[]> = {
  draft: [
    { nextStatus: "pending_review", nextRole: "route_supervisor", action: "submitted", allowedRoles: ["dispatcher"], nextHandlerRole: "route_supervisor" },
  ],
  pending_review: [
    { nextStatus: "reviewing", nextRole: "route_supervisor", action: "reviewing", allowedRoles: ["route_supervisor"], nextHandlerRole: "route_supervisor" },
  ],
  reviewing: [
    { nextStatus: "pending_approval", nextRole: "ops_center", action: "approved", allowedRoles: ["route_supervisor"], nextHandlerRole: "ops_center" },
  ],
  pending_approval: [
    { nextStatus: "approving", nextRole: "ops_center", action: "reviewing", allowedRoles: ["ops_center"], nextHandlerRole: "ops_center" },
  ],
  approving: [
    { nextStatus: "archived", nextRole: "ops_center", action: "archived", allowedRoles: ["ops_center"], nextHandlerRole: "ops_center" },
  ],
};

const VALID_ACTIONS: Record<string, string[]> = {
  draft: ["submit"],
  pending_review: ["review", "reject"],
  reviewing: ["approve", "reject"],
  pending_approval: ["review", "reject"],
  approving: ["archive", "reject"],
  returned: [],
  archived: [],
};

function getNextHandlerId(role: Role): string {
  const user = userRepo.findByUsername(role === "route_supervisor" ? "route_supervisor" : role === "ops_center" ? "ops_center" : "dispatcher");
  return user ? user.id : "";
}

export function createPlan(data: { planNumber: string; routeName: string; planDate: string; vehicleId: string; driverId: string; dueDate: string; notes: string }, userId: string): DispatchPlan {
  const plan = planRepo.create({
    planNumber: data.planNumber,
    routeName: data.routeName,
    planDate: data.planDate,
    vehicleId: data.vehicleId,
    driverId: data.driverId,
    dueDate: data.dueDate,
    notes: data.notes || "",
    createdBy: userId,
    currentHandler: userId,
    currentRole: "dispatcher",
  });
  planRepo.createProcessingRecord({
    planId: plan.id,
    action: "created",
    handlerId: userId,
    handlerRole: "dispatcher",
    comment: null,
    version: 1,
  });
  return plan;
}

export function advancePlan(
  planId: string,
  action: string,
  comment: string | null,
  userId: string,
  role: Role,
  version: number
): { success: boolean; reason?: string; plan?: DispatchPlan } {
  const plan = planRepo.findById(planId);
  if (!plan) return { success: false, reason: "计划不存在" };

  if (plan.version !== version) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "VERSION_CONFLICT",
      reasonDetail: `版本冲突：期望版本 ${plan.version}，实际传入 ${version}`,
      responsibleRole: role,
      responsibleUserId: userId,
      action,
      status: plan.status,
    });
    return { success: false, reason: "版本冲突，请刷新后重试" };
  }

  if (plan.expiryStatus === "overdue") {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "OVERDUE",
      reasonDetail: `计划已逾期，截止日期 ${plan.dueDate}`,
      responsibleRole: plan.currentRole,
      responsibleUserId: plan.currentHandler,
      action,
      status: plan.status,
    });
    return { success: false, reason: "计划已逾期，请先处理逾期责任人后再推进" };
  }

  if (plan.currentHandler !== userId) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "PERMISSION_DENIED",
      reasonDetail: `越权操作：当前处理人应为 ${plan.currentHandler}，实际操作人 ${userId}`,
      responsibleRole: plan.currentRole,
      responsibleUserId: plan.currentHandler,
      action,
      status: plan.status,
    });
    return { success: false, reason: "越权：不是当前处理人" };
  }

  const validActionsForStatus = VALID_ACTIONS[plan.status] || [];
  if (!validActionsForStatus.includes(action)) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "STATUS_CONFLICT",
      reasonDetail: `状态冲突：当前状态 ${plan.status} 不支持操作 ${action}`,
      responsibleRole: role,
      responsibleUserId: userId,
      action,
      status: plan.status,
    });
    return { success: false, reason: `当前状态 ${plan.status} 不支持操作 ${action}` };
  }

  if (action === "reject") {
    if (role !== "route_supervisor" && role !== "ops_center") {
      planRepo.createExceptionReason({
        planId,
        reasonCode: "PERMISSION_DENIED",
        reasonDetail: `无权限执行驳回操作：角色 ${role}`,
        responsibleRole: role,
        responsibleUserId: userId,
        action,
        status: plan.status,
      });
      return { success: false, reason: "无权限执行驳回操作" };
    }
    planRepo.update(planId, { status: "returned", currentRole: "dispatcher", currentHandler: getNextHandlerId("dispatcher"), version: plan.version + 1 });
    planRepo.createProcessingRecord({
      planId,
      action: "rejected",
      handlerId: userId,
      handlerRole: role,
      comment,
      version: plan.version + 1,
    });
    planRepo.createAuditNote({
      planId,
      noteType: "exception_return" as NoteType,
      content: comment || "驳回",
      createdBy: userId,
    });
    return { success: true, plan: planRepo.findById(planId) };
  }

  const transitions = VALID_TRANSITIONS[plan.status];
  if (!transitions || transitions.length === 0) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "STATUS_CONFLICT",
      reasonDetail: `当前状态 ${plan.status} 无法推进`,
      responsibleRole: role,
      responsibleUserId: userId,
      action,
      status: plan.status,
    });
    return { success: false, reason: `当前状态 ${plan.status} 无法推进` };
  }

  const transition = transitions[0];
  if (!transition.allowedRoles.includes(role)) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "PERMISSION_DENIED",
      reasonDetail: `无权限执行此操作：角色 ${role}，允许角色 ${transition.allowedRoles.join(",")}`,
      responsibleRole: role,
      responsibleUserId: userId,
      action,
      status: plan.status,
    });
    return { success: false, reason: "无权限执行此操作" };
  }

  if (plan.status === "pending_review") {
    const hasVehicleSchedule = planRepo.hasAttachment(planId, "vehicle_schedule");
    const hasDriverCheckin = planRepo.hasAttachment(planId, "driver_checkin");
    if (!hasVehicleSchedule || !hasDriverCheckin) {
      planRepo.createExceptionReason({
        planId,
        reasonCode: "MISSING_EVIDENCE",
        reasonDetail: `缺少必要凭证：vehicle_schedule=${hasVehicleSchedule}, driver_checkin=${hasDriverCheckin}`,
        responsibleRole: plan.currentRole,
        responsibleUserId: plan.currentHandler,
        action,
        status: plan.status,
      });
      return { success: false, reason: "缺少必要凭证：必须同时具备车辆排班表和司机签收单" };
    }
  }

  if (planRepo.hasProcessingRecord(planId, userId, transition.action)) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "STATUS_CONFLICT",
      reasonDetail: `重复操作：同一处理人不能对同一计划执行相同操作两次`,
      responsibleRole: role,
      responsibleUserId: userId,
      action,
      status: plan.status,
    });
    return { success: false, reason: "重复操作：同一处理人不能对同一计划执行相同操作两次" };
  }

  const nextHandlerId = getNextHandlerId(transition.nextHandlerRole);
  planRepo.update(planId, { status: transition.nextStatus, currentRole: transition.nextRole, currentHandler: nextHandlerId, version: plan.version + 1 });
  planRepo.createProcessingRecord({
    planId,
    action: transition.action,
    handlerId: userId,
    handlerRole: role,
    comment,
    version: plan.version + 1,
  });

  if (transition.nextStatus === "archived") {
    planRepo.createAuditNote({
      planId,
      noteType: "sign_complete" as NoteType,
      content: "签收完成，已归档",
      createdBy: userId,
    });
  } else {
    planRepo.createAuditNote({
      planId,
      noteType: "pending_sign" as NoteType,
      content: "待签收",
      createdBy: userId,
    });
  }

  return { success: true, plan: planRepo.findById(planId) };
}

export function correctPlan(planId: string, comment: string, userId: string, version: number): { success: boolean; reason?: string; plan?: DispatchPlan } {
  const plan = planRepo.findById(planId);
  if (!plan) return { success: false, reason: "计划不存在" };
  if (plan.version !== version) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "VERSION_CONFLICT",
      reasonDetail: `版本冲突：期望版本 ${plan.version}，实际传入 ${version}`,
      responsibleRole: "dispatcher",
      responsibleUserId: userId,
      action: "correct",
      status: plan.status,
    });
    return { success: false, reason: "版本冲突，请刷新后重试" };
  }
  if (plan.status !== "returned") {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "STATUS_CONFLICT",
      reasonDetail: `状态冲突：只有退回状态的计划才能补正，当前状态 ${plan.status}`,
      responsibleRole: "dispatcher",
      responsibleUserId: userId,
      action: "correct",
      status: plan.status,
    });
    return { success: false, reason: "只有退回状态的计划才能补正" };
  }
  if (plan.createdBy !== userId) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "PERMISSION_DENIED",
      reasonDetail: `越权操作：只有创建人 ${plan.createdBy} 才能补正，当前用户 ${userId}`,
      responsibleRole: plan.currentRole,
      responsibleUserId: plan.createdBy,
      action: "correct",
      status: plan.status,
    });
    return { success: false, reason: "只有创建人才能补正计划" };
  }

  const rejectCount = (plan.processingRecords || []).filter((r) => r.action === "rejected").length;
  if (rejectCount >= 2) {
    planRepo.createExceptionReason({
      planId,
      reasonCode: "RETURNED_CORRECT",
      reasonDetail: `第二次及以上退回后补正，累计退回次数 ${rejectCount}`,
      responsibleRole: "dispatcher",
      responsibleUserId: userId,
      action: "correct",
      status: plan.status,
    });
  }

  const nextHandlerId = getNextHandlerId("route_supervisor");
  planRepo.update(planId, { status: "pending_review", currentRole: "route_supervisor", currentHandler: nextHandlerId, version: plan.version + 1 });
  planRepo.createProcessingRecord({
    planId,
    action: "corrected",
    handlerId: userId,
    handlerRole: "dispatcher",
    comment,
    version: plan.version + 1,
  });
  planRepo.createAuditNote({
    planId,
    noteType: "pending_sign" as NoteType,
    content: "补正后重新提交，待签收",
    createdBy: userId,
  });

  return { success: true, plan: planRepo.findById(planId) };
}

export function rejectPlan(planId: string, reason: string, userId: string, role: Role, version: number): { success: boolean; reason?: string; plan?: DispatchPlan } {
  return advancePlan(planId, "reject", reason, userId, role, version);
}

export function batchAdvance(
  planIds: string[],
  action: string,
  comment: string | null,
  userId: string,
  role: Role,
  versions: Record<string, number>
): { planId: string; success: boolean; reason?: string }[] {
  return planIds.map((planId) => {
    const version = versions[planId];
    if (version === undefined) {
      return { planId, success: false, reason: "缺少版本号" };
    }
    const result = advancePlan(planId, action, comment, userId, role, version);
    return { planId, success: result.success, reason: result.reason };
  });
}

export function createAttachment(data: { planId: string; fileType: AttachmentCategory; fileName: string; uploadedBy: string }) {
  return planRepo.createAttachment(data);
}

export function getPlans(filters: { role?: Role; status?: string; expiry?: string; page?: number; limit?: number }) {
  return planRepo.findAll({
    role: filters.role,
    status: filters.status,
    expiry: filters.expiry as "normal" | "approaching" | "overdue" | undefined,
    page: filters.page || 1,
    limit: filters.limit || 20,
  });
}

export function getPlanDetail(id: string): DispatchPlan | undefined {
  return planRepo.findById(id);
}

export function getExpiryStats() {
  return planRepo.countByExpiryStatus();
}

export function getQueueStats(role?: Role) {
  return planRepo.countByStatus(role);
}

export function getEvidenceSummary() {
  return planRepo.countEvidence();
}
