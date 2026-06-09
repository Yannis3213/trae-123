'use client';

import { BorrowStatus, OverdueLevel, STATUS_DISPLAY, OVERDUE_DISPLAY, ROLE_DISPLAY, Role } from '@/types';

interface FilterBarProps {
  status: BorrowStatus | '';
  setStatus: (v: BorrowStatus | '') => void;
  overdueLevel: OverdueLevel | '';
  setOverdueLevel: (v: OverdueLevel | '') => void;
  role: Role | '';
  setRole: (v: Role | '') => void;
  keyword: string;
  setKeyword: (v: string) => void;
  onReset: () => void;
}

export default function FilterBar({
  status, setStatus, overdueLevel, setOverdueLevel,
  role, setRole, keyword, setKeyword, onReset,
}: FilterBarProps) {
  const allStatuses: BorrowStatus[] = [
    'pending_assignment', 'transferred', 'revisited',
    'returned_for_correction', 'reviewed_archived', 'overdue',
  ];
  const allOverdue: OverdueLevel[] = ['normal', 'approaching', 'overdue'];
  const allRoles: Role[] = [
    'registration_clerk', 'circulation_librarian',
    'cataloging_librarian', 'audit_supervisor', 'library_director',
  ];

  return (
    <div className="card p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="label">关键字</label>
          <input
            type="text"
            className="input"
            placeholder="读者姓名/证号/书名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div>
          <label className="label">状态</label>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as BorrowStatus | '')}
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%236b7280%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27M19 9l-7 7-7-7%27/%3E%3C/svg%3E")', backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
          >
            <option value="">全部状态</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>{STATUS_DISPLAY[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">到期预警</label>
          <select
            className="select"
            value={overdueLevel}
            onChange={(e) => setOverdueLevel(e.target.value as OverdueLevel | '')}
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%236b7280%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27M19 9l-7 7-7-7%27/%3E%3C/svg%3E")', backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
          >
            <option value="">全部</option>
            {allOverdue.map((o) => (
              <option key={o} value={o}>{OVERDUE_DISPLAY[o]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">按角色筛选</label>
          <select
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as Role | '')}
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%236b7280%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%272%27 d=%27M19 9l-7 7-7-7%27/%3E%3C/svg%3E")', backgroundSize: '1.25rem', backgroundPosition: 'right 0.5rem center' }}
          >
            <option value="">按当前角色</option>
            {allRoles.map((r) => (
              <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="btn-secondary flex-1" onClick={onReset}>重置</button>
        </div>
      </div>
    </div>
  );
}
