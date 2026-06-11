'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  title: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function DataTable<T extends object>({
  columns, data, rowKey, selectedIds, onSelectionChange, onRowClick,
  page, pageSize, total, onPageChange,
}: Props<T>) {
  const allKeys = data.map((r) => String(r[rowKey]));
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedIds.includes(k));

  const toggleAll = () => {
    if (allSelected) onSelectionChange(selectedIds.filter((id) => !allKeys.includes(id)));
    else onSelectionChange(Array.from(new Set([...selectedIds, ...allKeys])));
  };

  const toggleOne = (key: string) => {
    onSelectionChange(selectedIds.includes(key) ? selectedIds.filter((id) => id !== key) : [...selectedIds, key]);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-3 py-3 text-left w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
              </th>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-3 text-left font-medium text-gray-600" style={col.width ? { width: col.width } : undefined}>
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-gray-400">暂无数据</td></tr>
            )}
            {data.map((row) => {
              const key = String(row[rowKey]);
              const checked = selectedIds.includes(key);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${checked ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(key)} className="rounded" />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-3 text-gray-700">
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-sm text-gray-500">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
