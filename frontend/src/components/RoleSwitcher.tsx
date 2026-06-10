'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/context/RoleContext';
import { Role, RoleInfo, ROLE_DISPLAY, ROLE_OPERATORS } from '@/types';
import { api } from '@/lib/api';

export default function RoleSwitcher() {
  const { currentRole, currentOperator, setCurrentRole, setCurrentOperator } = useRole();
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.listRoles()) as RoleInfo[];
        setRoles(data);
      } catch (e) {
        console.error('Failed to load roles', e);
      }
    })();
  }, []);

  const handleChange = (role: Role) => {
    setCurrentRole(role);
    setCurrentOperator(ROLE_OPERATORS[role]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-library-700 hover:bg-library-600 px-3 py-1.5 rounded text-sm"
      >
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="font-medium">{ROLE_DISPLAY[currentRole]}</span>
        <span className="text-library-300 text-xs">|</span>
        <span className="text-library-100 text-xs">{currentOperator}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white text-library-800 rounded-md shadow-lg border border-library-200 py-1 z-50">
          <div className="px-3 py-2 border-b border-library-100 text-xs text-library-500">
            切换角色（用于测试）
          </div>
          {roles.map((r) => (
            <button
              key={r.role}
              onClick={() => handleChange(r.role)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-library-50 ${
                currentRole === r.role ? 'bg-library-50 text-library-800' : ''
              }`}
            >
              <div className="font-medium flex items-center gap-2">
                {r.role === currentRole && <span className="w-1.5 h-1.5 rounded-full bg-library-600" />}
                {r.name}
                <span className="text-xs text-library-400">（{ROLE_OPERATORS[r.role]}）</span>
              </div>
              <div className="text-xs text-library-500 ml-3.5 mt-0.5">{r.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
