'use client';

import { Search, Filter } from 'lucide-react';
import { CATEGORIES } from '@/types';
import type { Status } from '@/types';

interface Props {
  status: string;
  category: string;
  deadlineGroup: string;
  enterpriseName: string;
  keyword: string;
  onStatusChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onDeadlineGroupChange: (v: string) => void;
  onEnterpriseNameChange: (v: string) => void;
  onKeywordChange: (v: string) => void;
  onSearch: () => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending_submit', label: '待提交' },
  { value: 'pending_process', label: '待受理' },
  { value: 'processing', label: '处理中' },
  { value: 'pending_verify', label: '待核验' },
  { value: 'pending_review', label: '待复核' },
  { value: 'pending_archive', label: '待归档' },
  { value: 'archived', label: '已归档' },
  { value: 'returned', label: '已退回' },
  { value: 'resubmitted', label: '已重新提交' },
];

const DEADLINE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'approaching', label: '临期' },
  { value: 'overdue', label: '逾期' },
];

export default function FilterBar({
  status, category, deadlineGroup, enterpriseName, keyword,
  onStatusChange, onCategoryChange, onDeadlineGroupChange, onEnterpriseNameChange, onKeywordChange, onSearch,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={status} onChange={(e) => onStatusChange(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <select value={category} onChange={(e) => onCategoryChange(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary">
        <option value="">全部分类</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        value={enterpriseName}
        onChange={(e) => onEnterpriseNameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        placeholder="企业名称"
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary w-40"
      />
      <div className="flex items-center gap-1">
        {DEADLINE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onDeadlineGroupChange(o.value)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${deadlineGroup === o.value ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
        <input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="搜索工单号/标题/描述"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary"
        />
        <button onClick={onSearch} className="px-3 py-2 bg-primary text-white rounded-md text-sm hover:opacity-90">
          <Search className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
