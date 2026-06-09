import { Head } from "$fresh/runtime.ts";
import FlowDetailIsland from "../islands/FlowDetailIsland.tsx";
import { PageProps } from "$fresh/server.ts";

export default function FlowDetail(props: PageProps) {
  const id = props.params.id;
  return (
    <>
      <Head>
        <title>处方流转单详情 - 中医馆处方流转单系统</title>
      </Head>
      <div class="min-h-screen bg-gray-50">
        <header class="bg-white shadow-sm border-b">
          <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <a
                  href="/"
                  class="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                  ← 返回列表
                </a>
                <h1 class="text-xl font-bold text-gray-900">处方流转单详情</h1>
              </div>
              <a href="/" class="text-sm text-gray-500">
                前端端口: 3003 | 后端端口: 8003
              </a>
            </div>
          </div>
        </header>
        <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <FlowDetailIsland id={parseInt(id)} />
        </main>
      </div>
    </>
  );
}
