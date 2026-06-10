import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import { useAuthStore, ROLE_DISPLAY_NAMES } from '../store/useAuthStore';

const ROLES = [
  { key: 'dispatcher', label: '发车登记员' },
  { key: 'route_supervisor', label: '发车审核主管' },
  { key: 'ops_center', label: '复核负责人' },
];

export default function RoleSwitcher() {
  const { currentUser, switchRole } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayName = currentUser
    ? ROLE_DISPLAY_NAMES[currentUser.role] || currentUser.role
    : '未登录';

  async function handleSwitch(role: string) {
    setOpen(false);
    try {
      await switchRole(role);
    } catch (err) {
      console.error('切换角色失败', err);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-slate-700 transition-colors"
      >
        <User className="w-4 h-4" />
        <span className="text-sm font-medium">{displayName}</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => handleSwitch(r.key)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                currentUser?.role === r.key
                  ? 'text-brand-accent font-medium bg-orange-50'
                  : 'text-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
