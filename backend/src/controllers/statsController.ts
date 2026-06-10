import Router from "@koa/router";
import * as planService from "../services/planService.js";
import type { Role } from "../types/index.js";

const router = new Router();

router.get("/api/stats/expiry", async (ctx) => {
  const stats = planService.getExpiryStats();
  ctx.body = { data: stats };
});

router.get("/api/stats/queue", async (ctx) => {
  const { role } = ctx.query as { role?: string };
  const stats = planService.getQueueStats(role as Role | undefined);
  ctx.body = { data: stats };
});

router.get("/api/evidence/summary", async (ctx) => {
  const summary = planService.getEvidenceSummary();
  ctx.body = { data: summary };
});

export default router;
