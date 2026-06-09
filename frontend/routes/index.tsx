import { Head } from "$fresh/runtime.ts";
import FlowListIsland from "../islands/FlowListIsland.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>中医馆-处方流转单系统</title>
      </Head>
      <div class="min-h-screen bg-gray-50">
        <header class="bg-white shadow-sm border-b">
          <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between">
              <div>
                <h1 class="text-2xl font-bold text-gray-900">中医馆处方流转单系统</h1>
                <p class="mt-1 text-sm text-gray-500">月底集中处理 · 处方流转 · 煎药配送</p>
              </div>
              <div class="text-right">
                <p class="text-xs text-gray-500">前端端口: 3003 | 后端端口: 8003</p>
              </div>
            </div>
          </div>
        </header>
        <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <FlowListIsland />
        </main>
      </div>
    </>
  );
}
