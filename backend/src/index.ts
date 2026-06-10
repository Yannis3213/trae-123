import Koa from "koa";
import cors from "@koa/cors";
import koaBody from "koa-body";
import authMiddleware from "./middleware/auth.js";
import authRouter from "./controllers/authController.js";
import planRouter from "./controllers/planController.js";
import statsRouter from "./controllers/statsController.js";
import { seed } from "./database/seed.js";

const app = new Koa();

app.use(
  cors({
    origin: "http://localhost:3002",
    credentials: true,
  })
);

app.use(koaBody());

app.use(authMiddleware);

app.use(authRouter.routes());
app.use(authRouter.allowedMethods());
app.use(planRouter.routes());
app.use(planRouter.allowedMethods());
app.use(statsRouter.routes());
app.use(statsRouter.allowedMethods());

seed();

const PORT = 8002;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
