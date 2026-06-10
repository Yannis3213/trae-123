import Router from "@koa/router";
import * as planService from "../services/planService.js";
import type { Role } from "../types/index.js";

const router = new Router({ prefix: "/api/plans" });

router.post("/batch-advance", async (ctx) => {
  const { planIds, action, comment, versions } = ctx.request.body as {
    planIds: string[];
    action: string;
    comment?: string;
    versions: Record<string, number>;
  };
  const { userId, role } = ctx.state.user;

  if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
    ctx.status = 400;
    ctx.body = { error: "请选择要操作的计划" };
    return;
  }
  if (!action) {
    ctx.status = 400;
    ctx.body = { error: "请指定操作类型" };
    return;
  }
  if (!versions || typeof versions !== "object") {
    ctx.status = 400;
    ctx.body = { error: "缺少版本号映射" };
    return;
  }

  const results = planService.batchAdvance(planIds, action, comment || null, userId, role, versions);
  ctx.body = { data: results };
});

router.get("/", async (ctx) => {
  const { role, status, expiry, page, limit } = ctx.query as Record<string, string | undefined>;
  const result = planService.getPlans({
    role: role as Role | undefined,
    status,
    expiry,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
  });
  ctx.body = { data: result };
});

router.get("/:id", async (ctx) => {
  const plan = planService.getPlanDetail(ctx.params.id);
  if (!plan) {
    ctx.status = 404;
    ctx.body = { error: "计划不存在" };
    return;
  }
  ctx.body = { data: plan };
});

router.post("/", async (ctx) => {
  const { planNumber, routeName, planDate, vehicleId, driverId, dueDate, notes } = ctx.request.body as {
    planNumber: string; routeName: string; planDate: string; vehicleId: string; driverId: string; dueDate: string; notes?: string;
  };
  const userId = ctx.state.user.userId;

  if (!planNumber || !routeName || !planDate || !dueDate) {
    ctx.status = 400;
    ctx.body = { error: "缺少必填字段" };
    return;
  }

  const plan = planService.createPlan({ planNumber, routeName, planDate, vehicleId: vehicleId || "", driverId: driverId || "", dueDate, notes: notes || "" }, userId);
  ctx.status = 201;
  ctx.body = { data: plan };
});

router.put("/:id/advance", async (ctx) => {
  const planId = ctx.params.id;
  const { action, comment, version } = ctx.request.body as { action: string; comment?: string; version: number };
  const { userId, role } = ctx.state.user;

  if (!action) {
    ctx.status = 400;
    ctx.body = { error: "缺少操作类型" };
    return;
  }
  if (version === undefined || version === null) {
    ctx.status = 400;
    ctx.body = { error: "缺少版本号" };
    return;
  }

  const result = planService.advancePlan(planId, action, comment || null, userId, role, version);
  if (!result.success) {
    ctx.status = 400;
    ctx.body = { error: result.reason };
    return;
  }

  ctx.body = { data: result.plan };
});

router.put("/:id/correct", async (ctx) => {
  const planId = ctx.params.id;
  const { comment, version } = ctx.request.body as { comment?: string; version?: number };
  const userId = ctx.state.user.userId;

  if (!comment) {
    ctx.status = 400;
    ctx.body = { error: "补正说明不能为空" };
    return;
  }
  if (version === undefined || version === null) {
    ctx.status = 400;
    ctx.body = { error: "缺少版本号" };
    return;
  }

  const result = planService.correctPlan(planId, comment, userId, version);
  if (!result.success) {
    ctx.status = 400;
    ctx.body = { error: result.reason };
    return;
  }

  ctx.body = { data: result.plan };
});

router.put("/:id/reject", async (ctx) => {
  const planId = ctx.params.id;
  const { reason, version } = ctx.request.body as { reason?: string; version?: number };
  const { userId, role } = ctx.state.user;

  if (!reason) {
    ctx.status = 400;
    ctx.body = { error: "驳回原因不能为空" };
    return;
  }
  if (version === undefined || version === null) {
    ctx.status = 400;
    ctx.body = { error: "缺少版本号" };
    return;
  }

  const result = planService.rejectPlan(planId, reason, userId, role, version);
  if (!result.success) {
    ctx.status = 400;
    ctx.body = { error: result.reason };
    return;
  }

  ctx.body = { data: result.plan };
});

export default router;
