'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import RoleSwitcher from './RoleSwitcher';

export default function NavBar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: '借阅记录', exact: true },
    { href: '/readers', label: '读者档案' },
    { href: '/create', label: '借阅登记' },
    { href: '/overdue', label: '逾期处理' },
  ];

  return (
    <header className="bg-library-800 text-white shadow-md sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold tracking-wide">
              📚 图书馆月底集中处理系统
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      active
                        ? 'bg-library-600 text-white'
                        : 'text-library-100 hover:bg-library-700 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
}
