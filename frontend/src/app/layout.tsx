import type { Metadata } from 'next';
import './globals.css';
import { RoleProvider } from '@/context/RoleContext';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: '图书馆借阅记录集中处理系统',
  description: '月底集中处理借阅记录系统',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <RoleProvider>
          <NavBar />
          <main className="max-w-[1400px] mx-auto px-4 py-6">
            {children}
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
