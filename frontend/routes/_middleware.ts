import { MiddlewareHandlerContext } from "$fresh/server.ts";

export async function handler(_req: Request, ctx: MiddlewareHandlerContext) {
  const resp = await ctx.next();
  resp.headers.set("X-Frame-Options", "SAMEORIGIN");
  resp.headers.set("X-Content-Type-Options", "nosniff");
  return resp;
}
