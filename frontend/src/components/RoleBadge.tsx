'use client';

import { ROLE_LABELS, type Role } from '@/types';

const ROLE_COLORS: Record<Role, string> = {
  enterprise_service: 'bg-sky-100 text-sky-700',
  engineering_supervisor: 'bg-indigo-100 text-indigo-700',
  park_manager: 'bg-emerald-100 text-emerald-700',
};

interface Props {
  role: Role;
}

export default function RoleBadge({ role }: Props) {
  const label = ROLE_LABELS[role] ?? role;
  const color = ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
