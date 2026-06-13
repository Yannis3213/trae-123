import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import AppLayout from '@/components/AppLayout';

export const metadata = {
  title: '连锁药房-月底集中处理近效期处理单系统',
  description: '近效期药品处理单管理系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
