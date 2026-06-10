import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '银行网点 - 月底集中处理开户申请系统',
  description: '月底集中处理开户申请系统 - 客户经理、运营主管、支行行长三级审批',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
