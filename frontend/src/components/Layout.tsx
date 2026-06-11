import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ClipboardList, PlusCircle, AlertTriangle, FileText, User, Menu, X, LogOut } from 'lucide-react';
import { useAppStore } from '@/store';
import { USER_ROLE_LABELS } from '@/types';

const navItems = [
  { to: '/orders', label: '订单列表', icon: ClipboardList },
  { to: '/orders/new', label: '新增订单', icon: PlusCircle },
  { to: '/warnings', label: '到期预警', icon: AlertTriangle },
  { to: '/audit', label: '审计日志', icon: FileText },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const { currentUser, switchRole } = useAppStore();
  const navigate = useNavigate();

  const roleOptions = [
    { userId: 'u1', label: '张伟（场地登记员）', role: 'registrar' },
    { userId: 'u2', label: '李明（审核主管）', role: 'reviewer' },
    { userId: 'u3', label: '王芳（复核负责人）', role: 'approver' },
  ];

  const handleSwitchRole = async (userId: string) => {
    await switchRole(userId);
    setRoleDropdownOpen(false);
  };

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-primary text-white transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-primary-light">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <ClipboardList size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-wide">场馆订单系统</span>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'bg-primary-light text-white shadow-md'
                    : 'text-blue-100 hover:bg-primary-light/40 hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <button
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <User size={16} className="text-primary" />
              <span className="text-sm font-medium text-gray-700">
                {currentUser ? `${currentUser.displayName}（${USER_ROLE_LABELS[currentUser.role] || currentUser.role}）` : '未登录'}
              </span>
            </button>
            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-3 py-2 text-xs text-gray-400 border-b">切换角色</div>
                {roleOptions.map((opt) => (
                  <button
                    key={opt.userId}
                    onClick={() => handleSwitchRole(opt.userId)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                      currentUser?.id === opt.userId ? 'text-primary font-medium bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="border-t mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    退出系统
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
