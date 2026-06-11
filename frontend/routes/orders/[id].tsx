import { Head } from "$fresh/runtime.ts";
import { RouteContext } from "$fresh/server.ts";
import Navbar from "../../islands/Navbar.tsx";
import OrderDetail from "../../islands/OrderDetail.tsx";

export default function OrderDetailPage(_req: Request, ctx: RouteContext) {
  const id = Number(ctx.params.id);

  return (
    <>
      <Head>
        <title>选品单详情 - 直播选品单管理系统</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OrderDetail id={id} />
        </main>
      </div>
    </>
  );
}
