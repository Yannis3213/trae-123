'use client';

import { useEffect, useState, useCallback } from 'react';
import { BorrowRecord, BorrowStatus, OverdueLevel, Role } from '@/types';
import { api } from '@/lib/api';
import { useRole } from '@/context/RoleContext';
import StatisticsPanel from '@/components/StatisticsPanel';
import FilterBar from '@/components/FilterBar';
import RecordTable from '@/components/RecordTable';
import BatchProcessPanel from '@/components/BatchProcessPanel';

export default function HomePage() {
  const { currentRole } = useRole();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BorrowStatus | ''>('');
  const [overdueLevel, setOverdueLevel] = useState<OverdueLevel | ''>('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      const effectiveRole = roleFilter || currentRole;
      if (effectiveRole) params.role = effectiveRole;
      if (status) params.status = status;
      if (overdueLevel) params.overdue_level = overdueLevel;
      if (keyword) params.reader_keyword = keyword;
      params.page = '1';
      params.page_size = '200';
      const data = (await api.listBorrowRecords(params)) as BorrowRecord[];
      setRecords(data);
    } finally {
      setLoading(false);
    }
  }, [currentRole, status, overdueLevel, roleFilter, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  const onReset = () => {
    setStatus('');
    setOverdueLevel('');
    setRoleFilter('');
    setKeyword('');
    setSelectedIds(new Set());
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">借阅记录工作台</h1>
          <p className="text-sm text-library-500 mt-1">
            按角色权限展示可办理的借阅记录，支持批量推进与异常追溯
          </p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? '刷新中...' : '🔄 刷新'}
        </button>
      </div>

      <StatisticsPanel />
      <FilterBar
        status={status}
        setStatus={setStatus}
        overdueLevel={overdueLevel}
        setOverdueLevel={setOverdueLevel}
        role={roleFilter}
        setRole={setRoleFilter}
        keyword={keyword}
        setKeyword={setKeyword}
        onReset={onReset}
      />
      <BatchProcessPanel
        records={records}
        selectedIds={selectedIds}
        onClear={() => setSelectedIds(new Set())}
        onDone={() => {
          load();
          setSelectedIds(new Set());
        }}
      />
      {loading ? (
        <div className="card p-8 text-center text-library-500">加载中...</div>
      ) : (
        <RecordTable
          records={records}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allSelected={selectedIds.size === records.length && records.length > 0}
        />
      )}
    </div>
  );
}
