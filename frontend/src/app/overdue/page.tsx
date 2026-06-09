'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { BorrowRecord, STATUS_COLOR, OVERDUE_COLOR, STATUS_DISPLAY, OVERDUE_DISPLAY, ROLE_DISPLAY } from '@/types';
import { api } from '@/lib/api';
import { useRole } from '@/context/RoleContext';

export default function OverduePage() {
  const { currentRole } = useRole();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'approaching' | 'timeout'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const all = (await api.listBorrowRecords({ page_size: '500' })) as BorrowRecord[];
      setRecords(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'overdue':
        return records.filter((r) => r.overdue_level === 'overdue');
      case 'approaching':
        return records.filter((r) => r.overdue_level === 'approaching');
      case 'timeout':
        return records.filter((r) => r.node_timeout);
      default:
        return records.filter(
          (r) => r.overdue_level !== 'normal' || r.node_timeout
        );
    }
  }, [records, filter]);

  const stats = useMemo(() => ({
    overdue: records.filter((r) => r.overdue_level === 'overdue').length,
    approaching: records.filter((r) => r.overdue_level === 'approaching').length,
    timeout: records.filter((r) => r.node_timeout).length,
  }), [records]);

  if (loading) {
    return <div className="card p-8 text-center">加载中...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">逾期处理</h1>
          <p className="text-sm text-library-500 mt-1">
            按到期预警、节点超时集中展示；批量推进逐条校验，异常拦截进入审计备注
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-secondary">← 返回工作台</Link>
          <button className="btn-secondary" onClick={load}>🔄 刷新</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`card p-4 ${filter === 'overdue' ? 'ring-2 ring-red-400' : ''} cursor-pointer`} onClick={() => setFilter('overdue')}>
          <div className="text-xs text-red-600">已逾期</div>
          <div className="text-3xl font-bold text-red-700 mt-1">{stats.overdue}</div>
          <div className="text-xs text-library-500 mt-2">超过到期日期，需立即处理</div>
        </div>
        <div className={`card p-4 ${filter === 'approaching' ? 'ring-2 ring-amber-400' : ''} cursor-pointer`} onClick={() => setFilter('approaching')}>
          <div className="text-xs text-amber-600">临期（≤3天）</div>
          <div className="text-3xl font-bold text-amber-700 mt-1">{stats.approaching}</div>
          <div className="text-xs text-library-500 mt-2">3天内即将到期</div>
        </div>
        <div className={`card p-4 ${filter === 'timeout' ? 'ring-2 ring-red-400' : ''} cursor-pointer`} onClick={() => setFilter('timeout')}>
          <div className="text-xs text-red-600">节点超时</div>
          <div className="text-3xl font-bold text-red-700 mt-1">{stats.timeout}</div>
          <div className="text-xs text-library-500 mt-2">超过节点时限，仅馆长可推进</div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-library-600">筛选：</span>
        {(['all', 'overdue', 'approaching', 'timeout'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1 text-xs rounded-full border ${
              filter === k
                ? 'bg-library-700 text-white border-library-700'
                : 'bg-white text-library-600 border-library-200 hover:bg-library-50'
            }`}
          >
            {k === 'all' ? '全部异常' : k === 'overdue' ? '已逾期' : k === 'approaching' ? '临期' : '节点超时'}
          </button>
        ))}
        <span className="text-xs text-library-500 ml-4">当前角色：{ROLE_DISPLAY[currentRole]}</span>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-library-500">没有符合条件的记录 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th>读者</th>
                  <th>图书</th>
                  <th>借阅</th>
                  <th>到期</th>
                  <th>状态</th>
                  <th>预警</th>
                  <th>超时责任人</th>
                  <th>缺失材料</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-medium">{r.reader_name}</div>
                      <div className="text-xs text-library-500">{r.reader_card_number}</div>
                    </td>
                    <td>
                      <div className="font-medium">{r.book_title}</div>
                      <div className="text-xs text-library-500">{r.book_isbn}</div>
                    </td>
                    <td className="whitespace-nowrap">{r.borrow_date}</td>
                    <td className="whitespace-nowrap">
                      <span className={r.overdue_level === 'overdue' ? 'text-red-600 font-medium' : ''}>
                        {r.due_date}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLOR[r.status]}`}>{STATUS_DISPLAY[r.status]}</span>
                    </td>
                    <td>
                      <span className={`badge ${OVERDUE_COLOR[r.overdue_level]}`}>
                        {OVERDUE_DISPLAY[r.overdue_level]}
                      </span>
                    </td>
                    <td className="text-sm">
                      {r.node_timeout ? (
                        <span className="text-red-600 font-medium">
                          {r.timeout_responsible || '借阅登记员'}
                        </span>
                      ) : (
                        <span className="text-library-400">-</span>
                      )}
                    </td>
                    <td className="text-sm">
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
                        详情办理 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-library-500 bg-library-50 p-3 rounded">
        <strong>提示：</strong>
        逾期批量推进不会整批放行，每条记录会被独立校验（越权 / 版本冲突 / 资料缺失 / 节点超时），
        被拦截的异常会写入详情页中的「审计备注」栏，可追溯具体原因。
      </div>
    </div>
  );
}
