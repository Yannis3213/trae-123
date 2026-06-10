import { FreshContext, Handlers, PageProps } from "$fresh/server.ts";
import { define } from "$fresh/runtime.ts";
import { App } from "./components/App.tsx";

export const handler: Handlers = {
  async GET(req: Request, ctx: FreshContext) {
    const resp = await ctx.next();
    const url = new URL(req.url);
    const port = Deno.env.get("FRONTEND_PORT") || "8002";
    resp.headers.set("X-Port", port);
    return resp;
  },
};

export default function Page(props: PageProps) {
  return <App url={props.url} route={props.route} />;
}
