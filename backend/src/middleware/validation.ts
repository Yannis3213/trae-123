import type { Middleware } from "@koa/router";

export const validateAdvance: Middleware = async (ctx, next) => {
  const { action, version } = ctx.request.body as { action?: string; version?: number };

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

  await next();
};

export const validateCreate: Middleware = async (ctx, next) => {
  const { planNumber, routeName, planDate, dueDate } = ctx.request.body as { planNumber?: string; routeName?: string; planDate?: string; dueDate?: string };

  if (!planNumber) {
    ctx.status = 400;
    ctx.body = { error: "缺少计划编号" };
    return;
  }
  if (!routeName) {
    ctx.status = 400;
    ctx.body = { error: "缺少线路名称" };
    return;
  }
  if (!planDate) {
    ctx.status = 400;
    ctx.body = { error: "缺少发车日期" };
    return;
  }
  if (!dueDate) {
    ctx.status = 400;
    ctx.body = { error: "缺少截止日期" };
    return;
  }

  await next();
};
