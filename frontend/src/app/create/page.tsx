'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Reader, ROLE_DISPLAY } from '@/types';
import { api } from '@/lib/api';
import { useRole } from '@/context/RoleContext';

export default function CreateRecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentRole, currentOperator } = useRole();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [readerId, setReaderId] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [bookIsbn, setBookIsbn] = useState('');
  const [borrowDate, setBorrowDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [hasProof, setHasProof] = useState(false);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successId, setSuccessId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = (await api.listReaders()) as Reader[];
        setReaders(data);
        const prefilled = searchParams.get('readerId');
        if (prefilled && data.some((r) => r.id === prefilled)) {
          setReaderId(prefilled);
        } else if (data.length > 0) {
          setReaderId(data[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  const selectedReader = readers.find((r) => r.id === readerId);

  const handleSubmit = async () => {
    if (currentRole !== 'registration_clerk') {
      setError('仅借阅登记员可创建借阅登记，请切换角色');
      return;
    }
    if (!readerId) return setError('请选择读者');
    if (!bookTitle.trim()) return setError('请填写图书名称');
    if (!bookIsbn.trim()) return setError('请填写ISBN');
    if (borrowDate > dueDate) return setError('借阅日期不能晚于到期日期');

    setSubmitting(true);
    setError('');
    try {
      const materials: string[] = [];
      if (hasProof) materials.push('借阅凭证');
      if (hasIdentity) materials.push('身份证明');

      const data = await api.createBorrowRecord({
        reader_id: readerId,
        book_title: bookTitle.trim(),
        book_isbn: bookIsbn.trim(),
        borrow_date: borrowDate,
        due_date: dueDate,
        operator: currentOperator,
        operator_role: currentRole,
        initial_materials: materials,
      }) as any;

      setSuccessId(data.id);
    } catch (e: any) {
      setError(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="card p-8 text-center">加载中...</div>;
  }

  if (successId) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto">
        <div className="text-5xl mb-3">✅</div>
        <div className="text-xl font-bold mb-2">借阅登记已创建</div>
        <div className="text-sm text-library-600 mb-6">
          记录已进入「待分派」队列，流通馆员可继续办理
        </div>
        <div className="flex gap-2 justify-center">
          <Link href={`/records/${successId}`} className="btn-primary">
            前往详情办理
          </Link>
          <Link href="/" className="btn-secondary">
            返回工作台
          </Link>
          <Link href="/overdue" className="btn-secondary">
            去逾期处理
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">借阅登记</h1>
          <p className="text-sm text-library-500 mt-1">
            借阅登记员发起新记录 → 流通馆员分派 → 采编馆员中段 → 审核主管回访 → 馆长归档
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-secondary">← 返回工作台</Link>
          <Link href="/readers" className="btn-secondary">读者档案</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-6">
          {currentRole !== 'registration_clerk' && (
            <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              ⚠ 当前角色是 <strong>{ROLE_DISPLAY[currentRole]}</strong>，仅借阅登记员可创建新记录。请在右上角切换角色。
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">选择读者</label>
              <select
                className="select"
                value={readerId}
                onChange={(e) => setReaderId(e.target.value)}
              >
                {readers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} - {r.card_number}（{r.department}）
                  </option>
                ))}
              </select>
              {selectedReader && (
                <div className="text-xs text-library-500 mt-1">
                  联系电话：{selectedReader.phone}
                </div>
              )}
            </div>

            <div>
              <label className="label">图书名称 *</label>
              <input
                type="text"
                className="input"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="例如：深入理解计算机系统"
              />
            </div>
            <div>
              <label className="label">ISBN *</label>
              <input
                type="text"
                className="input"
                value={bookIsbn}
                onChange={(e) => setBookIsbn(e.target.value)}
                placeholder="例如：978-7-111-54493-7"
              />
            </div>

            <div>
              <label className="label">借阅日期 *</label>
              <input
                type="date"
                className="input"
                value={borrowDate}
                onChange={(e) => setBorrowDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">到期日期 *</label>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">初始材料（缺少的材料会在后续流转中被拦截）</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasProof}
                    onChange={(e) => setHasProof(e.target.checked)}
                    className="rounded"
                  />
                  借阅凭证
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasIdentity}
                    onChange={(e) => setHasIdentity(e.target.checked)}
                    className="rounded"
                  />
                  身份证明
                </label>
              </div>
              <div className="text-xs text-library-500 mt-1">
                提示：故意不勾选可测试"资料缺失"的异常拦截场景
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
              ✗ {error}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={submitting || currentRole !== 'registration_clerk'}
            >
              {submitting ? '提交中...' : '创建借阅登记'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => router.back()}
            >
              取消
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-sm font-medium text-library-600 mb-2">登记后流转路径</div>
            <ol className="text-xs space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-200 text-yellow-800 flex items-center justify-center font-bold">1</span>
                借阅登记员创建（待分派）
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center font-bold">2</span>
                流通馆员分派（已转办）
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center font-bold">3</span>
                采编馆员处理（已回访）
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold">4</span>
                审核主管办理
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-200 text-green-800 flex items-center justify-center font-bold">5</span>
                馆长复核归档
              </li>
            </ol>
          </div>

          <div className="card p-4">
            <div className="text-sm font-medium text-library-600 mb-2">测试场景建议</div>
            <ul className="text-xs text-library-600 space-y-1 list-disc pl-4">
              <li>故意不勾选材料，测试资料缺失拦截</li>
              <li>把到期日期设为昨天，测试自动识别逾期</li>
              <li>创建后立刻切其他角色，测试越权拦截</li>
              <li>从读者档案页面直接带参数发起</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
