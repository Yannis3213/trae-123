import { Component, For, createSignal, Show } from 'solid-js';
import type { BatchResultItem } from '../types';
import { STATUS_LABELS, ACTION_LABELS, REASON_CODE_LABELS } from '../utils/status';

interface BatchResultProps {
  results: BatchResultItem[];
}

const formatException = (summary: string | undefined | null): string => {
  if (!summary) return '';
  return summary
    .split(' | ')
    .map((s) => {
      const [code, ...rest] = s.split(': ');
      const label = REASON_CODE_LABELS[code] || code;
      return `${label}${rest.length ? ': ' + rest.join(': ') : ''}`;
    })
    .join('；');
};

const BatchResult: Component<BatchResultProps> = (props) => {
  const successCount = () => props.results.filter((r) => r.success).length;
  const failCount = () => props.results.filter((r) => !r.success).length;
  const [expandedId, setExpandedId] = createSignal<number | null>(null);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '32px',
          marginBottom: '16px',
          padding: '16px',
          background: '#fafafa',
          'border-radius': '8px',
          'flex-wrap': 'wrap',
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
          <span style={{ color: '#666', 'font-size': '14px' }}>总计：</span>
          <span style={{ color: '#333', 'font-size': '22px', 'font-weight': '700' }}>
            {props.results.length}
          </span>
          <span style={{ color: '#999', 'font-size': '12px' }}>条</span>
        </div>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
          <span style={{ color: '#666', 'font-size': '14px' }}>成功：</span>
          <span style={{ color: '#52c41a', 'font-size': '22px', 'font-weight': '700' }}>
            {successCount()}
          </span>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              'border-radius': '50%',
              background: '#52c41a',
            }}
          ></span>
        </div>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
          <span style={{ color: '#666', 'font-size': '14px' }}>失败：</span>
          <span style={{ color: '#ff4d4f', 'font-size': '22px', 'font-weight': '700' }}>
            {failCount()}
          </span>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              'border-radius': '50%',
              background: '#ff4d4f',
            }}
          ></span>
        </div>
        {failCount() === 0 && successCount() > 0 && (
          <div
            style={{
              padding: '6px 16px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              'border-radius': '4px',
              color: '#52c41a',
              'font-size': '14px',
              'font-weight': '500',
            }}
          >
            ✅ 全部处理成功，所有记录已写入 SQLite（process_records + exception_reasons + audit_notes）
          </div>
        )}
        {failCount() > 0 && successCount() > 0 && (
          <div
            style={{
              padding: '6px 16px',
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              'border-radius': '4px',
              color: '#d48806',
              'font-size': '14px',
              'font-weight': '500',
            }}
          >
            ⚠️ 部分处理失败，成功记录已持久化，失败原因请查看下方表格，未产生任何 process_records 变更
          </div>
        )}
        {failCount() > 0 && successCount() === 0 && (
          <div
            style={{
              padding: '6px 16px',
              background: '#fff1f0',
              border: '1px solid #ffa39e',
              'border-radius': '4px',
              color: '#ff4d4f',
              'font-size': '14px',
              'font-weight': '500',
            }}
          >
            ❌ 全部失败，请查看下方失败原因逐条处理后重试
          </div>
        )}
      </div>

      <div
        style={{
          maxHeight: '460px',
          overflow: 'auto',
          border: '1px solid #f0f0f0',
          'border-radius': '8px',
        }}
      >
        <table>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              <th style={{ width: '48px' }}>序</th>
              <th>申请编号</th>
              <th>操作</th>
              <th>目标状态</th>
              <th>新版本</th>
              <th style={{ width: '56px' }}>结果</th>
              <th>成功/失败原因</th>
              <th>异常摘要</th>
              <th>补正说明</th>
              <th>审计备注</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.results}>
              {(result, index) => {
                const expanded = () => expandedId() === result.id;
                return (
                  <>
                    <tr
                      style={{
                        cursor: 'pointer',
                        background: result.success ? undefined : '#fffbf0',
                      }}
                      onClick={() => setExpandedId(expanded() ? null : result.id)}
                    >
                      <td>{index() + 1}</td>
                      <td style={{ color: '#1890ff', 'font-weight': '500' }}>
                        {result.application_no || `#${result.id}`}
                      </td>
                      <td>{ACTION_LABELS[result.action] || result.action}</td>
                      <td>
                        {result.to_status ? (
                          <span
                            class="tag"
                            style={{
                              padding: '2px 8px',
                              'border-radius': '4px',
                              'font-size': '12px',
                              background: '#e6f7ff',
                              color: '#1890ff',
                              border: '1px solid #91d5ff',
                            }}
                          >
                            {STATUS_LABELS[result.to_status]}
                          </span>
                        ) : (
                          <span style={{ color: '#ccc' }}>-</span>
                        )}
                      </td>
                      <td style={{ 'text-align': 'center', color: '#666' }}>
                        {result.new_version ? (
                          <span style={{ color: '#1890ff', 'font-weight': '600' }}>
                            v{result.new_version}
                          </span>
                        ) : (
                          <span style={{ color: '#ccc' }}>-</span>
                        )}
                      </td>
                      <td style={{ 'text-align': 'center' }}>
                        {result.success ? (
                          <span
                            class="tag status-completed"
                            style={{ padding: '2px 8px', 'border-radius': '4px' }}
                          >
                            ✅ 成功
                          </span>
                        ) : (
                          <span
                            class="tag status-exception"
                            style={{ padding: '2px 8px', 'border-radius': '4px' }}
                          >
                            ❌ 失败
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          color: result.success ? '#52c41a' : '#ff4d4f',
                          'font-size': '13px',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                          'white-space': 'nowrap',
                        }}
                        title={result.message}
                      >
                        {result.message || (result.success ? '处理完成' : '未知错误')}
                      </td>
                      <td
                        style={{
                          maxWidth: '120px',
                          'font-size': '12px',
                          color: result.exception_summary ? '#fa8c16' : '#ccc',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                          'white-space': 'nowrap',
                        }}
                        title={formatException(result.exception_summary)}
                      >
                        {result.exception_summary
                          ? formatException(result.exception_summary)
                          : <span style={{ color: '#ccc' }}>无</span>}
                      </td>
                      <td
                        style={{
                          maxWidth: '120px',
                          'font-size': '12px',
                          color: result.rectify_note ? '#52c41a' : '#ccc',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                          'white-space': 'nowrap',
                        }}
                        title={result.rectify_note}
                      >
                        {result.rectify_note || <span style={{ color: '#ccc' }}>-</span>}
                      </td>
                      <td
                        style={{
                          maxWidth: '140px',
                          'font-size': '12px',
                          color: '#d48806',
                          overflow: 'hidden',
                          'text-overflow': 'ellipsis',
                          'white-space': 'nowrap',
                        }}
                        title={result.audit_note}
                      >
                        {result.audit_note ? (
                          expanded() ? result.audit_note : (
                            result.audit_note.substring(0, 20) + (result.audit_note.length > 20 ? '...' : '')
                          )
                        ) : (
                          <span style={{ color: '#ccc' }}>-</span>
                        )}
                      </td>
                    </tr>
                    <Show when={expanded() && (result.message || result.audit_note || result.exception_summary || result.rectify_note)}>
                      <tr
                        style={{
                          background: '#fafafa',
                          'border-top': '1px dashed #d9d9d9',
                        }}
                      >
                        <td colspan="10" style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(2, 1fr)', gap: '16px' }}>
                            <div>
                              <div style={{ color: '#666', 'font-size': '12px', marginBottom: '4px', 'font-weight': '500' }}>
                                📝 处理消息：
                              </div>
                              <div style={{
                                padding: '8px 12px',
                                background: '#fff',
                                border: `1px solid ${result.success ? '#b7eb8f' : '#ffa39e'}`,
                                'border-radius': '4px',
                                color: result.success ? '#389e0d' : '#cf1322',
                                'font-size': '13px',
                                'line-height': '1.6',
                              }}>
                                {result.message}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#666', 'font-size': '12px', marginBottom: '4px', 'font-weight': '500' }}>
                                🔍 审计备注（SQLite audit_notes 表）：
                              </div>
                              <div style={{
                                padding: '8px 12px',
                                background: '#fffbe6',
                                border: '1px solid #ffe58f',
                                'border-radius': '4px',
                                color: '#d48806',
                                'font-size': '13px',
                                'line-height': '1.6',
                              }}>
                                {result.audit_note || <span style={{ color: '#999' }}>无审计备注</span>}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#666', 'font-size': '12px', marginBottom: '4px', 'font-weight': '500' }}>
                                ⚠️ 异常摘要（exception_reasons 表未解决项）：
                              </div>
                              <div style={{
                                padding: '8px 12px',
                                background: result.exception_summary ? '#fff7e6' : '#fff',
                                border: result.exception_summary ? '1px solid #ffd591' : '1px solid #f0f0f0',
                                'border-radius': '4px',
                                color: result.exception_summary ? '#d46b08' : '#999',
                                'font-size': '13px',
                                'line-height': '1.6',
                              }}>
                                {result.exception_summary
                                  ? formatException(result.exception_summary)
                                  : '无异常记录'}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: '#666', 'font-size': '12px', marginBottom: '4px', 'font-weight': '500' }}>
                                ✅ 补正说明（exception_reasons.resolved=1）：
                              </div>
                              <div style={{
                                padding: '8px 12px',
                                background: result.rectify_note ? '#f6ffed' : '#fff',
                                border: result.rectify_note ? '1px solid #b7eb8f' : '1px solid #f0f0f0',
                                'border-radius': '4px',
                                color: result.rectify_note ? '#389e0d' : '#999',
                                'font-size': '13px',
                                'line-height': '1.6',
                              }}>
                                {result.rectify_note || '无补正记录'}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Show>
                  </>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '12px', color: '#999', 'font-size': '12px' }}>
        💡 说明：成功的记录已原子写入 SQLite 的
        <code
          style={{
            padding: '2px 6px',
            background: '#f5f5f5',
            'border-radius': '3px',
            color: '#666',
            margin: '0 4px',
          }}
        >process_records</code>（处理流水）、
        <code
          style={{
            padding: '2px 6px',
            background: '#f5f5f5',
            'border-radius': '3px',
            color: '#666',
            margin: '0 4px',
          }}
        >exception_reasons</code>（异常/退回/补正记录）、
        <code
          style={{
            padding: '2px 6px',
            background: '#f5f5f5',
            'border-radius': '3px',
            color: '#666',
            margin: '0 4px',
          }}
        >audit_notes</code>（批量审计追踪）三张表；
        失败的记录不产生任何数据库变更，可回到列表/详情页逐条处理。
      </div>
    </div>
  );
};

export default BatchResult;
