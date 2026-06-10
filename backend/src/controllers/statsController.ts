import Router from "@koa/router";
import * as planService from "../services/planService.js";
import type { Role } from "../types/index.js";

const router = new Router();

router.get("/api/stats/expiry", async (ctx) => {
  const { role, status, handler } = ctx.query as { role?: string; status?: string; handler?: string };
  const stats = planService.getExpiryStats({
    role: role as Role | undefined,
    status,
    handler,
  });
  ctx.body = { data: stats };
});

router.get("/api/stats/queue", async (ctx) => {
  const { role, status, handler } = ctx.query as { role?: string; status?: string; handler?: string };
  const stats = planService.getQueueStats({
    role: role as Role | undefined,
    status,
    handler,
  });
  ctx.body = { data: stats };
});

router.get("/api/evidence/summary", async (ctx) => {
  const { role, status, handler } = ctx.query as { role?: string; status?: string; handler?: string };
  const summary = planService.getEvidenceSummary({
    role: role as Role | undefined,
    status,
    handler,
  });
  ctx.body = { data: summary };
});

export default router;
