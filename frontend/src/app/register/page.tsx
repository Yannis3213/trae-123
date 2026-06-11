'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Send, ShieldAlert } from 'lucide-react';
import { useStore } from '@/store';
import { CATEGORY_OPTIONS } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const { currentUser, createOrder, createAndSubmitOrder, loading } = useStore();

  const [form, setForm] = useState({
    title: '',
    description: '',
    enterprise_name: '',
    contact_person: '',
    contact_phone: '',
    category: '',
    urgency: 'normal',
    deadline: '',
  });

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSaveDraft = async () => {
    if (!currentUser) return;
    const data = { ...form, created_by: currentUser.id, created_by_role: currentUser.role };
    const ok = await createOrder(data);
    if (ok) {
      alert('草稿保存成功');
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    const data = { ...form, created_by: currentUser.id, created_by_role: currentUser.role };
    const orderId = await createAndSubmitOrder(data);
    if (orderId) {
      router.push('/');
    }
  };

  if (currentUser?.role !== 'enterprise_service') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">无访问权限</h2>
        <p className="text-gray-400">仅企业客服角色可登记报修单</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">报修单登记</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">标题 <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={(e) => update('title', e.target.value)} className="input-field" placeholder="请输入报修标题" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={4} className="input-field" placeholder="请详细描述报修问题" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">企业名称 <span className="text-red-500">*</span></label>
              <input value={form.enterprise_name} onChange={(e) => update('enterprise_name', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">联系人 <span className="text-red-500">*</span></label>
              <input value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 <span className="text-red-500">*</span></label>
              <input value={form.contact_phone} onChange={(e) => update('contact_phone', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分类 <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={(e) => update('category', e.target.value)} className="input-field">
                <option value="">请选择</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">紧急程度</label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="urgency" value="normal" checked={form.urgency === 'normal'} onChange={(e) => update('urgency', e.target.value)} className="text-primary" />
                  <span className="text-sm text-gray-700">普通</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="urgency" value="urgent" checked={form.urgency === 'urgent'} onChange={(e) => update('urgency', e.target.value)} className="text-primary" />
                  <span className="text-sm text-red-600">紧急</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">截止日期 <span className="text-red-500">*</span></label>
              <input type="date" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">附件</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <p className="text-sm text-gray-400">点击或拖拽文件到此区域上传</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={handleSaveDraft} disabled={loading} className="btn-outline flex items-center gap-1">
            <Save className="w-4 h-4" /> 保存草稿
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-1">
            <Send className="w-4 h-4" /> 提交
          </button>
        </div>
      </div>
    </div>
  );
}
