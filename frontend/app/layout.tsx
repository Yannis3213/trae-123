import type { Metadata } from 'next';
import './globals.css';
import HeaderBar from '../components/HeaderBar';

export const metadata: Metadata = {
  title: '酒店集团-月底集中处理住客订单系统',
  description: '月底集中处理住客订单：待分派 / 已转办 / 已回访 三段式流程',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <HeaderBar />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
