'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';

const EVIDENCE_LABEL: Record<string, string> = {
  id_card: '身份证凭证', registration_form: '入住登记单',
  deposit_slip: '押金收据', review_note: '核验/回访记录', other: '其他材料',
};

export default function NewOrderPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    order_no: `G${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 9000) + 1000)}`,
    guest_name: '',
    room_no: '',
    check_in_date: new Date().toISOString().slice(0, 10),
    check_out_date: '',
    amount: '',
    order_type: 'normal',
    deadline_hours: 24,
    evidence_types: ['id_card', 'registration_form'] as string[],
    remark: '',
    note_content: '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err' | 'info' | 'warn'; text: string } | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleEvidence = (et: string) => {
    setForm(f => ({
      ...f,
      evidence_types: f.evidence_types.includes(et)
        ? f.evidence_types.filter(x => x !== et)
        : [...f.evidence_types, et],
    }));
  };

  const resetForm = () => {
    setForm({
      order_no: `G${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 9000) + 1000)}`,
      guest_name: '',
      room_no: '',
      check_in_date: new Date().toISOString().slice(0, 10),
      check_out_date: '',
      amount: '',
      order_type: 'normal',
      deadline_hours: 24,
      evidence_types: ['id_card', 'registration_form'] as string[],
      remark: '',
      note_content: '',
    });
    setMessage(null);
    setBusy(false);
  };

  // ====== 统一事件监听：角色切换后重置表单（避免跨角色数据污染）======
  useEffect(() => {
    const handleRefresh = () => resetForm();
    if (typeof window !== 'undefined') {
      window.addEventListener('hotel:user-switched', handleRefresh);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('hotel:user-switched', handleRefresh);
      }
    };
  }, []);

  const submit = async () => {
    if (!form.guest_name || !form.check_in_date || !form.amount) {
      setMessage({ type: 'err', text: '住客姓名、入住日期、金额为必填项' });
      return;
    }
    setBusy(true);
    const r = await api.createOrder({
      order_no: form.order_no,
      guest_name: form.guest_name,
      room_no: form.room_no || undefined,
      check_in_date: form.check_in_date,
      check_out_date: form.check_out_date || undefined,
      amount: parseFloat(form.amount as string) || 0,
      order_type: form.order_type,
      deadline_hours: Number(form.deadline_hours) || 24,
      evidence_types: form.evidence_types,
      remark: form.remark || undefined,
      note_content: form.note_content || undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setMessage({ type: 'err', text: `登记失败：${r.message}（code=${r.code}）${r.missing ? `，缺少证据：${r.missing.join('、')}` : ''}` });
      return;
    }
    setMessage({ type: 'ok', text: `住客订单登记成功，状态=待分派，订单号=${form.order_no}，即将跳转列表` });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel:order-changed'));
    }
    setTimeout(() => router.push(`/orders/${r.data!.order.id}`), 1200);
  };

  return (
    <div>
      <div className="breadcrumb"><Link href="/">住客订单列表</Link> / <span>新建住客订单登记</span></div>
      {message && (
        <div className={`banner banner-${message.type === 'ok' ? 'ok' : message.type === 'err' ? 'err' : message.type === 'warn' ? 'warn' : 'info'}`}>
          {message.text}
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📝 住客订单登记（住客登记员发起）</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>登记完成后进入【待分派】状态，转办后进入【已转办】状态</div>
        </div>
        <div className="card-body" style={{ maxWidth: 760 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-row">
              <label className="form-label">订单号（必填 · 唯一）</label>
              <input className="input" value={form.order_no} onChange={e => set('order_no', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">住客姓名（必填）</label>
              <input className="input" value={form.guest_name} onChange={e => set('guest_name', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">房号</label>
              <input className="input" value={form.room_no} onChange={e => set('room_no', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">订单类型</label>
              <select className="select" value={form.order_type} onChange={e => set('order_type', e.target.value)}>
                <option value="normal">普通订单</option>
                <option value="vip">VIP 订单</option>
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">入住日期（必填）</label>
              <input type="date" className="input" value={form.check_in_date} onChange={e => set('check_in_date', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">退房日期</label>
              <input type="date" className="input" value={form.check_out_date} onChange={e => set('check_out_date', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">订单金额（必填）</label>
              <input className="input" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">处理期限（小时）</label>
              <input className="input" type="number" value={form.deadline_hours} onChange={e => set('deadline_hours', e.target.value)} />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 6 }}>
            <label className="form-label">
              登记阶段必填证据（后端会校验附件表实际存在，勾选只用于演示。缺少【身份证/入住登记单】将被拦截。）
            </label>
            <div className="checkbox-group">
              {['id_card', 'registration_form', 'deposit_slip', 'review_note', 'other'].map(et => (
                <label key={et}>
                  <input type="checkbox"
                    checked={form.evidence_types.includes(et)}
                    onChange={() => toggleEvidence(et)} />
                  {EVIDENCE_LABEL[et]}
                </label>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">处理备注（选填 · 进入审计轨迹）</label>
            <textarea className="textarea" value={form.remark} onChange={e => set('remark', e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">审计备注（选填 · 永久留存）</label>
            <textarea className="textarea" value={form.note_content} onChange={e => set('note_content', e.target.value)} />
          </div>

          <div className="banner banner-info" style={{ marginTop: 12 }}>
            登记时校验项：①住客登记员角色 ②订单号唯一 ③必填证据（身份证+入住登记单）勾选。
            登记后将自动创建处理记录，状态为【待分派】，处理人为您自己。
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <Link className="btn" href="/">取消</Link>
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? '提交中…' : '登记住客订单 → 待分派'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
