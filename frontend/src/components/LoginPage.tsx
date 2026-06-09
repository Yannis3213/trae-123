'use client';

import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📚</div>
          <h1 className="text-2xl font-bold">图书馆月底集中处理系统</h1>
          <p className="text-sm text-library-500 mt-1">
            演示系统 - 无需登录，直接在右上角切换角色
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded bg-library-50 border border-library-200">
            <div className="font-medium text-library-700">角色说明</div>
            <ul className="mt-2 space-y-1 text-xs text-library-600 list-disc pl-4">
              <li>借阅登记员：发起和补正借阅记录</li>
              <li>流通馆员：处理待分派队列</li>
              <li>采编馆员：处理中段（已转办）</li>
              <li>借阅审核主管：办理已回访记录</li>
              <li>馆长：负责最终复核归档</li>
            </ul>
          </div>
        </div>
        <div className="mt-6">
          <Link href="/" className="btn-primary w-full justify-center">
            进入系统 →
          </Link>
        </div>
      </div>
    </div>
  );
}
