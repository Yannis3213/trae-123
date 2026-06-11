import { Head } from "$fresh/runtime.ts";
import Navbar from "../islands/Navbar.tsx";
import OrderList from "../islands/OrderList.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>选品单列表 - 直播选品单管理系统</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OrderList />
        </main>
      </div>
    </>
  );
}
