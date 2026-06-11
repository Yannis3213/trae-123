import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, getCurrentUser, ROLE_LABELS } from '../lib/api';

export default function CreateTask() {
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [planName, setPlanName] = createSignal('');
  const [planYear, setPlanYear] = createSignal(new Date().getFullYear());
  const [planMonth, setPlanMonth] = createSignal(new Date().getMonth() + 1);
  const [deadline, setDeadline] = createSignal('');

  const user = () => getCurrentUser();

  const submit = async (e: Event) => {
    e.preventDefault();
    setError('');
    if (!title()) {
      setError('任务标题不能为空');
      return;
    }
    setLoading(true);
    try {
      await api.tasks.create({
        title: title(),
        description: description(),
        planName: planName(),
        planYear: planYear(),
        planMonth: planMonth(),
        deadline: deadline() || undefined,
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="p-6 max-w-2xl mx-auto">
      <div class="flex items-center gap-4 mb-6">
        <button class="btn-secondary btn-sm" onClick={() => navigate('/')}>← 返回</button>
        <h2 class="text-xl font-bold text-gray-900">新建种植任务</h2>
      </div>

      <Show when={error()}>
        <div class="mb-4 p-3 bg-danger-50 text-danger-600 text-sm rounded-lg">{error()}</div>
      </Show>

      <div class="card p-6">
        <form onSubmit={submit}>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">任务标题 *</label>
            <input type="text" class="input" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="例：小麦种植-东区3号田" />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">任务描述</label>
            <textarea class="input min-h-[80px]" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} placeholder="详细描述种植任务..." />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">种植计划</label>
            <input type="text" class="input" value={planName()} onInput={(e) => setPlanName(e.currentTarget.value)} placeholder="例：2026年夏播小麦计划" />
          </div>
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">计划年度</label>
              <input type="number" class="input" value={planYear()} onInput={(e) => setPlanYear(Number(e.currentTarget.value))} />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">计划月份</label>
              <select class="select" value={planMonth()} onChange={(e) => setPlanMonth(Number(e.currentTarget.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option value={i + 1}>{i + 1}月</option>
                ))}
              </select>
            </div>
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
            <input type="date" class="input" value={deadline()} onInput={(e) => setDeadline(e.currentTarget.value)} />
          </div>
          <div class="flex gap-2 justify-end">
            <button type="button" class="btn-secondary" onClick={() => navigate('/')}>取消</button>
            <button type="submit" class="btn-primary" disabled={loading()}>{loading() ? '创建中...' : '创建任务'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
