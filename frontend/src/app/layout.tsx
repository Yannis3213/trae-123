'use client';

import { Noto_Sans_SC } from 'next/font/google';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, FilePlus, BookOpen, ChevronDown } from 'lucide-react';
import { useStore } from '@/store';
import { ROLE_LABELS } from '@/types';
import { useState, useRef, useEffect } from 'react';
import './globals.css';

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-noto-sans-sc',
});

const NAV_ITEMS = [
  { href: '/', label: '报修单列表', icon: ClipboardList },
  { href: '/register', label: '报修单登记', icon: FilePlus },
  { href: '/ledger', label: '报修单台账', icon: BookOpen },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, setCurrentUser, presetUsers } = useStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <html lang="zh-CN">
      <body className={`${notoSansSC.variable} font-sans bg-gray-50`}>
        <div className="flex h-screen overflow-hidden">
          <aside className="w-56 bg-primary flex flex-col flex-shrink-0">
            <div className="px-5 py-4 border-b border-white/10">
              <h1 className="text-white font-bold text-lg leading-tight">产业园物业</h1>
              <h2 className="text-white/80 text-sm">报修单系统</h2>
            </div>
            <nav className="flex-1 py-4">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                      active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-5 py-4 border-t border-white/10">
              <div className="text-white/50 text-xs">版本 v1.0</div>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
              <div className="text-sm text-gray-500">
                {currentUser && (
                  <span>当前角色: <strong className="text-gray-800">{ROLE_LABELS[currentUser.role]}</strong> - {currentUser.name}</span>
                )}
              </div>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 text-sm"
                >
                  <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">
                    {currentUser?.name.charAt(currentUser.name.length - 1) ?? '?'}
                  </span>
                  <span className="text-gray-700">{currentUser?.name ?? '选择角色'}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                    {presetUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { setCurrentUser(u); setDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${currentUser?.id === u.id ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700'}`}
                      >
                        <span className="text-xs text-gray-400 mr-2">[{ROLE_LABELS[u.role]}]</span>
                        {u.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </header>

            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
