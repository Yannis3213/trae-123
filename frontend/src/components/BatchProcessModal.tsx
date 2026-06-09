import { createSignal, For, Show } from 'solid-js';
import type { TreatmentPlanItem, ProcessAction } from '@/types';
import { batchProcessPlans } from '@/api';
import { useToast } from '@/utils';
import { planStatusTagClass, statusTag } from '@/utils';

interface BatchProcessModalProps {
  visible: boolean;
  items: TreatmentPlanItem[];
  action: ProcessAction;
  actionLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

const actionOptions: Array<{ value: ProcessAction; label: string }> = [
  { value: 'confirm', label: '确认' },
  { value: 'mark_exception', label: '标记异常' },
  { value: 'resolve_exception', label: '补正后提交复查' },
  { value: 'submit_review', label: '提交复查' },
  { value: 'review', label: '复查通过' },
  { value: 'archive', label: '归档' },
];

export default function BatchProcessModal(props: BatchProcessModalProps) {
  const { toast, show } = useToast();
  const [remark, setRemark] = createSignal('');
  const [selectedAction, setSelectedAction] = createSignal<ProcessAction>(props.action);
  const [loading, setLoading] = createSignal(false);
  const [results, setResults] = createSignal<Array<{ id: number | string; planNo?: string; success: boolean; reason?: string }> | null>(null);

  const handleSubmit = async () => {
    if (!remark().trim()) {
      show('error', '请填写办理意见');
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const res = await batchProcessPlans({
        items: props.items.map((i) => ({
          id: i.id,
          version: i.version,
          action: selectedAction(),
          remark: remark(),
        })),
      });
      const mapped = res.data.results.map((r) => {
        const item = props.items.find((p) => String(p.id) === String(r.id));
        return {
          id: r.id,
          planNo: item?.planNo || String(r.id),
          success: r.success,
          reason: r.reason,
        };
      });
      setResults(mapped);
      const successCount = mapped.filter((r) => r.success).length;
      show('success', `批量处理完成：成功 ${successCount} 条，失败 ${mapped.length - successCount} 条`);
      if (successCount > 0) {
        setTimeout(() => {
          props.onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      show('error', err.message || '批量处理失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRemark('');
    setResults(null);
    props.onClose();
  };

  return (
    <Show when={props.visible}>
      <div class="modal-mask" onClick={handleClose}>
        <div class="modal" style={{ width: '680px' }} onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <div class="modal-title">批量{props.actionLabel}</div>
            <button class="modal-close" onClick={handleClose}>
              ×
            </button>
          </div>

          <div style={{ 'margin-bottom': '16px' }}>
            <div style={{ 'font-weight': '500', 'margin-bottom': '8px' }}>
              已选择 {props.items.length} 条单据
            </div>
            <div style={{ 'max-height': '180px', overflowY: 'auto', border: '1px solid #e8e8e8', 'border-radius': '4px' }}>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>计划单号</th>
                    <th>患者姓名</th>
                    <th>当前状态</th>
                    <th>处理人</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={props.items}>
                    {(item) => (
                      <tr>
                        <td>{item.planNo}</td>
                        <td>{item.patientName}</td>
                        <td>
                          <span class={planStatusTagClass(item.status)}>
                            {statusTag(item.status)}
                          </span>
                        </td>
                        <td>{item.currentHandler}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">办理动作</label>
            <select
              class="form-select"
              value={selectedAction()}
              onChange={(e) => setSelectedAction((e.target as HTMLSelectElement).value as ProcessAction)}
            >
              <For each={actionOptions}>
                {(opt) => (
                  <option value={opt.value}>{opt.label}</option>
                )}
              </For>
            </select>
          </div>

          <div class="form-item">
            <label class="form-label">办理意见</label>
            <textarea
              class="form-textarea"
              placeholder="请输入办理意见"
              value={remark()}
              onInput={(e) => setRemark((e.target as HTMLTextAreaElement).value)}
            />
          </div>

          <Show when={results()}>
            <div
              style={{
                padding: '12px',
                background: '#fafafa',
                'border-radius': '4px',
                'margin-bottom': '8px',
              }}
            >
              <div style={{ 'font-weight': '500', 'margin-bottom': '8px' }}>处理结果：</div>
              <div style={{ 'max-height': '150px', overflowY: 'auto' }}>
                <For each={results()}>
                  {(r) => (
                    <div
                      style={{
                        padding: '6px 0',
                        'border-bottom': '1px solid #f0f0f0',
                        display: 'flex',
                        'justify-content': 'space-between',
                      }}
                    >
                      <span>
                        {r.planNo} - {r.success ? '✅ 成功' : '❌ 失败'}
                      </span>
                      <Show when={!r.success}>
                        <span style={{ color: '#ff4d4f' }}>{r.reason}</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div class="modal-footer">
            <button class="btn" onClick={handleClose}>
              取消
            </button>
            <button
              class="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading() || (results() !== null)}
            >
              {loading() ? '处理中...' : '提交'}
            </button>
          </div>

          <Show when={toast()}>
            <div class={`toast toast-${toast()!.type}`}>{toast()!.message}</div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
