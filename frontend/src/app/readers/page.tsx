'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Reader, BorrowRecord } from '@/types';
import { api } from '@/lib/api';

export default function ReadersPage() {
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [selectedReader, setSelectedReader] = useState<Reader | null>(null);
  const [readerRecords, setReaderRecords] = useState<BorrowRecord[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.listReaders()) as Reader[];
        setReaders(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadReaderRecords = async (reader: Reader) => {
    setSelectedReader(reader);
    try {
      const all = (await api.listBorrowRecords({ page_size: '200' })) as BorrowRecord[];
      setReaderRecords(all.filter((r) => r.reader_id === reader.id));
    } catch {
      setReaderRecords([]);
    }
  };

  const filtered = readers.filter(
    (r) =>
      !keyword ||
      r.name.includes(keyword) ||
      r.card_number.includes(keyword) ||
      r.department.includes(keyword)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">读者档案</h1>
          <p className="text-sm text-library-500 mt-1">选择读者可查看借阅记录，点击"新建借阅登记"发起新流程</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-secondary">← 返回工作台</Link>
          <Link href="/create" className="btn-primary">+ 新建借阅登记</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="p-4 border-b border-library-200">
            <input
              type="text"
              className="input"
              placeholder="搜索读者姓名 / 证号 / 部门"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="scroll-area" style={{ maxHeight: 560 }}>
            {loading ? (
              <div className="p-8 text-center text-library-500">加载中...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-library-500">未找到匹配的读者</div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadReaderRecords(r)}
                  className={`w-full text-left p-4 border-b border-library-100 hover:bg-library-50 ${
                    selectedReader?.id === r.id ? 'bg-library-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-library-500 font-mono">{r.card_number}</div>
                  </div>
                  <div className="text-xs text-library-500 mt-1">
                    {r.department} · {r.phone}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card p-4">
          {!selectedReader ? (
            <div className="h-full flex flex-col items-center justify-center text-library-500 py-16">
              <div className="text-4xl mb-3">👤</div>
              <div>请在左侧选择读者查看借阅记录</div>
              <div className="text-xs mt-2">支持从读者档案直接发起新借阅登记</div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-lg font-bold">{selectedReader.name}</div>
                  <div className="text-xs text-library-500">
                    {selectedReader.card_number} · {selectedReader.department} · {selectedReader.phone}
                  </div>
                </div>
                <Link href={`/create?readerId=${selectedReader.id}`} className="btn-primary">
                  为此读者新建借阅
                </Link>
              </div>
              <div className="divider" />
              <div className="text-sm font-medium text-library-600 mb-2">
                借阅记录（{readerRecords.length}）
              </div>
              {readerRecords.length === 0 ? (
                <div className="text-sm text-library-500 py-6 text-center">该读者暂无借阅记录</div>
              ) : (
                <div className="space-y-2">
                  {readerRecords.map((r) => (
                    <div key={r.id} className="border border-library-200 rounded p-3 hover:bg-library-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{r.book_title}</div>
                          <div className="text-xs text-library-500 mt-0.5">
                            借阅 {r.borrow_date} → 到期 {r.due_date}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`badge ${r.overdue_level === 'overdue' ? 'bg-red-100 text-red-700' : r.overdue_level === 'approaching' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {r.overdue_level === 'normal' ? '正常' : r.overdue_level === 'approaching' ? '临期' : '逾期'}
                          </span>
                          <span className="text-xs text-library-600">
                            {r.status === 'pending_assignment' ? '待分派' : r.status === 'transferred' ? '已转办' : r.status === 'revisited' ? '已回访' : r.status === 'returned_for_correction' ? '退回补正' : r.status === 'reviewed_archived' ? '复核归档' : '已逾期'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Link href={`/records/${r.id}`} className="text-xs text-library-600 hover:text-library-800 font-medium">
                          办理此记录 →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
