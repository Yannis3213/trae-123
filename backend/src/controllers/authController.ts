import Router from "@koa/router";
import * as authService from "../services/authService.js";

const router = new Router({ prefix: "/api/auth" });

router.post("/login", async (ctx) => {
  const { username, password } = ctx.request.body as { username?: string; password?: string };

  if (!username || !password) {
    ctx.status = 400;
    ctx.body = { error: "用户名和密码不能为空" };
    return;
  }

  const user = authService.login(username, password);
  if (!user) {
    ctx.status = 401;
    ctx.body = { error: "用户名或密码错误" };
    return;
  }

  ctx.body = { data: user };
});

router.get("/me", async (ctx) => {
  const userId = ctx.state.user?.userId;
  if (!userId) {
    ctx.status = 401;
    ctx.body = { error: "未认证" };
    return;
  }

  const user = authService.getCurrentUser(userId);
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: "用户不存在" };
    return;
  }

  ctx.body = { data: user };
});

export default router;
