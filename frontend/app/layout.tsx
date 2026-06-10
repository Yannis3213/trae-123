import type { Metadata } from 'next';
import '../styles/globals.css';
import { RoleProvider } from '../lib/roleContext';

export const metadata: Metadata = {
  title: '服装加工厂 - 打样任务管理系统',
  description: '月底集中处理打样任务系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <RoleProvider>
          {children}
        </RoleProvider>
      </body>
    </html>
  );
}
