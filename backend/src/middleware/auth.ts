import type { Middleware } from "@koa/router";
import type { Role } from "../types/index.js";

const authMiddleware: Middleware = async (ctx, next) => {
  const userId = ctx.headers["x-user-id"] as string | undefined;
  const role = ctx.headers["x-role"] as Role | undefined;

  if (ctx.path === "/api/auth/login" || ctx.method === "OPTIONS") {
    return await next();
  }

  if (!userId || !role) {
    ctx.status = 401;
    ctx.body = { error: "未提供认证信息" };
    return;
  }

  ctx.state.user = { userId, role };
  await next();
};

export default authMiddleware;
