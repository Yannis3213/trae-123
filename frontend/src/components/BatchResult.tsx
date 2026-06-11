import { Component, For } from 'solid-js';
import type { BatchResultItem } from '../types';
import { STATUS_LABELS, ACTION_LABELS, REASON_CODE_LABELS } from '../utils/status';

interface BatchResultProps {
  results: BatchResultItem[];
}

const BatchResult: Component<BatchResultProps> = (props) => {
  const successCount = () => props.results.filter((r) => r.success).length;
  const failCount = () => props.results.filter((r) => !r.success).length;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '16px',
          padding: '16px',
          background: '#fafafa',
          'border-radius': '4px',
        }}
      >
        <div>
          <span style={{ color: '#666', 'font-size': '14px' }}>成功：</span>
          <span style={{ color: '#52c41a', 'font-size': '18px', 'font-weight': '600' }}>
            {successCount()}
          </span>
        </div>
        <div>
          <span style={{ color: '#666', 'font-size': '14px' }}>失败：</span>
          <span style={{ color: '#ff4d4f', 'font-size': '18px', 'font-weight': '600' }}>
            {failCount()}
          </span>
        </div>
        <div>
          <span style={{ color: '#666', 'font-size': '14px' }}>总计：</span>
          <span style={{ color: '#333', 'font-size': '18px', 'font-weight': '600' }}>
            {props.results.length}
          </span>
        </div>
      </div>

      <div
        style={{
          maxHeight: '400px',
          overflow: 'auto',
          border: '1px solid #f0f0f0',
          'border-radius': '4px',
        }}
      >
        <table>
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr>
              <th style={{ width: '50px' }}>序号</th>
              <th>申请编号</th>
              <th>操作</th>
              <th>目标状态</th>
              <th style={{ width: '60px' }}>结果</th>
              <th>原因</th>
              <th>异常摘要</th>
              <th>补正记录</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.results}>
              {(result, index) => (
                <tr>
                  <td>{index() + 1}</td>
                  <td style={{ color: '#1890ff' }}>{result.application_no || `#${result.id}`}</td>
                  <td>{ACTION_LABELS[result.action]}</td>
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
                      '-'
                    )}
                  </td>
                  <td>
                    {result.success ? (
                      <span class="tag status-completed">成功</span>
                    ) : (
                      <span class="tag status-exception">失败</span>
                    )}
                  </td>
                  <td style={{ color: result.success ? '#52c41a' : '#ff4d4f', 'font-size': '13px' }}>
                    {result.message || (result.success ? '处理完成' : '未知错误')}
                  </td>
                  <td style={{ 'font-size': '12px', color: '#fa8c16', maxWidth: '120px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }} title={result.exception_summary || ''}>
                    {result.exception_summary || <span style={{color:'#ccc'}}>-</span>}
                  </td>
                  <td style={{ 'font-size': '12px', color: '#52c41a', maxWidth: '120px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }} title={result.rectify_note || ''}>
                    {result.rectify_note || <span style={{color:'#ccc'}}>-</span>}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BatchResult;
