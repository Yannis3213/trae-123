'use client';

import Link from 'next/link';
import { BorrowRecord, STATUS_COLOR, OVERDUE_COLOR, STATUS_DISPLAY, OVERDUE_DISPLAY, ROLE_DISPLAY } from '@/types';

interface RecordTableProps {
  records: BorrowRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
}

export default function RecordTable({
  records, selectedIds, onToggleSelect, onToggleSelectAll, allSelected,
}: RecordTableProps) {
  if (!records.length) {
    return (
      <div className="card p-12 text-center text-library-500">
        暂无符合条件的借阅记录
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-library-300"
                />
              </th>
              <th>读者</th>
              <th>图书</th>
              <th>借阅日期</th>
              <th>到期日期</th>
              <th>状态</th>
              <th>预警</th>
              <th>当前处理人</th>
              <th>超时</th>
              <th>缺材料</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => onToggleSelect(r.id)}
                    className="rounded border-library-300"
                  />
                </td>
                <td>
                  <div className="font-medium">{r.reader_name}</div>
                  <div className="text-xs text-library-500">{r.reader_card_number}</div>
                </td>
                <td>
                  <div className="font-medium">{r.book_title}</div>
                  <div className="text-xs text-library-500">{r.book_isbn}</div>
                </td>
                <td className="whitespace-nowrap">{r.borrow_date}</td>
                <td className="whitespace-nowrap">{r.due_date}</td>
                <td>
                  <span className={`badge ${STATUS_COLOR[r.status]}`}>
                    {STATUS_DISPLAY[r.status]}
                  </span>
                </td>
                <td>
                  <span className={`badge ${OVERDUE_COLOR[r.overdue_level]}`}>
                    {OVERDUE_DISPLAY[r.overdue_level]}
                  </span>
                </td>
                <td>
                  <div>{r.current_handler || '-'}</div>
                  {r.current_handler_role && (
                    <div className="text-xs text-library-500">
                      {ROLE_DISPLAY[r.current_handler_role]}
                    </div>
                  )}
                </td>
                <td>
                  {r.node_timeout ? (
                    <span className="text-red-600 font-medium text-sm">
                      是 · {r.timeout_responsible}
                    </span>
                  ) : (
                    <span className="text-library-400">-</span>
                  )}
                </td>
                <td>
                  {r.missing_materials.length > 0 ? (
                    <span className="text-orange-600 text-xs">
                      {r.missing_materials.join('、')}
                    </span>
                  ) : (
                    <span className="text-library-400">-</span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <Link href={`/records/${r.id}`} className="text-library-600 hover:text-library-800 font-medium text-sm">
                    办理 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
