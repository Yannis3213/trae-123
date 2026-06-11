import { Head } from "$fresh/runtime.ts";
import Navbar from "../islands/Navbar.tsx";
import OverdueQueue from "../islands/OverdueQueue.tsx";

export default function OverdueQueuePage() {
  return (
    <>
      <Head>
        <title>到期预警 - 直播选品单管理系统</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <OverdueQueue />
        </main>
      </div>
    </>
  );
}
