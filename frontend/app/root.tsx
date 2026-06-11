import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
  useLoaderData,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import stylesheet from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const userIdMatch = cookieHeader.match(/current_user_id=([^;]+)/);
  const userId = userIdMatch ? userIdMatch[1] : "zhangsan";
  return json({ userId });
}

const ROLE_MAP: Record<string, { label: string; role: string }> = {
  zhangsan: { label: "创意需求登记员", role: "creative_registrar" },
  lisi: { label: "创意需求审核主管", role: "review_supervisor" },
  wangwu: { label: "广告代理公司复核负责人", role: "review_manager" },
};

const NAV_ITEMS = [
  { label: "工作台", href: "/creative-requests", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "批量处理", href: "/batch-results", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { label: "统计", href: "/", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];

export default function App() {
  const { userId } = useLoaderData<typeof loader>();
  const user = ROLE_MAP[userId] || ROLE_MAP.zhangsan;

  return (
    <html lang="zh-CN" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full font-[Inter,sans-serif] bg-gray-50">
        <div className="flex h-full">
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
            <div className="h-16 flex items-center px-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-gray-900">创意需求单系统</span>
              </div>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  prefetch="intent"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="px-4 py-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">当前用户</div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-700">{userId[0].toUpperCase()}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{userId}</div>
                  <div className="text-xs text-blue-600">{user.label}</div>
                </div>
              </div>
            </div>
          </aside>
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
              <div />
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">切换用户:</span>
                <select
                  value={userId}
                  onChange={(e) => {
                    document.cookie = `current_user_id=${e.target.value};path=/;max-age=31536000`;
                    window.location.reload();
                  }}
                  className="block w-56 rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {Object.entries(ROLE_MAP).map(([id, info]) => (
                    <option key={id} value={id}>
                      {id} - {info.label}
                    </option>
                  ))}
                </select>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6">
              <Outlet context={{ userId, role: user.role }} />
            </main>
          </div>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
