import { LitElement, html, css } from 'lit'

class BatchResult extends LitElement {
  static properties = {
    result: { type: Object }
  }

  constructor() {
    super()
    this.result = null
  }

  render() {
    if (!this.result) return ''

    const { success_count, fail_count, results, message } = this.result

    return html`
      <div class="batch-result-modal" @click=${(e) => e.target === e.currentTarget && this.dispatchEvent(new CustomEvent('close'))}>
        <div class="batch-result-content">
          <div class="batch-result-header">
            <h2>批量处理结果</h2>
            <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>×</button>
          </div>
          
          <div class="batch-result-summary">
            <div class="summary-item success">
              <div class="count">${success_count}</div>
              <div class="label">成功</div>
            </div>
            <div class="summary-item fail">
              <div class="count">${fail_count}</div>
              <div class="label">失败</div>
            </div>
          </div>

          <div class="batch-result-list">
            ${results.map(result => html`
              <div class="result-item ${result.success ? 'success' : 'fail'}">
                <div class="order-info">
                  <div class="order-no">${result.order_no || `#${result.order_id}`}</div>
                  <div class="message">${result.message || result.error}</div>
                  ${result.code ? html`<div class="error-code">错误代码：${result.code}</div>` : ''}
                  ${result.old_status && result.new_status ? html`
                    <div class="error-code" style="color: #667eea;">
                      流转：${result.old_status} → ${result.new_status}
                      ${result.old_stage && result.new_stage ? ` | 环节：${result.old_stage} → ${result.new_stage}` : ''}
                      ${result.new_version ? ` | 新版本：v${result.new_version}` : ''}
                    </div>
                  ` : ''}
                </div>
                <div class="status-icon">
                  ${result.success ? '✓' : '✗'}
                </div>
              </div>
            `)}
          </div>

          <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>
              确定
            </button>
          </div>
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
    }

    .batch-result-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .batch-result-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    }

    .batch-result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .batch-result-header h2 {
      font-size: 16px;
      color: #111;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
      line-height: 1;
      padding: 0;
      width: 32px;
      height: 32px;
    }

    .close-btn:hover {
      color: #333;
    }

    .batch-result-summary {
      display: flex;
      gap: 20px;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .summary-item {
      flex: 1;
      text-align: center;
      padding: 16px;
      border-radius: 8px;
    }

    .summary-item.success {
      background: #dcfce7;
    }

    .summary-item.fail {
      background: #fee2e2;
    }

    .summary-item .count {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .summary-item.success .count {
      color: #16a34a;
    }

    .summary-item.fail .count {
      color: #dc2626;
    }

    .summary-item .label {
      font-size: 13px;
      color: #6b7280;
    }

    .batch-result-list {
      padding: 16px 24px;
      overflow-y: auto;
      flex: 1;
    }

    .result-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
    }

    .result-item:last-child {
      margin-bottom: 0;
    }

    .result-item.success {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    .result-item.fail {
      background: #fef2f2;
      border-color: #fecaca;
    }

    .result-item .order-info {
      flex: 1;
    }

    .result-item .order-no {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }

    .result-item .message {
      font-size: 12px;
      color: #4b5563;
    }

    .result-item .error-code {
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
    }

    .result-item.fail .error-code {
      color: #dc2626;
    }

    .result-item .status-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 700;
      flex-shrink: 0;
      margin-left: 12px;
    }

    .result-item.success .status-icon {
      background: #10b981;
      color: white;
    }

    .result-item.fail .status-icon {
      background: #ef4444;
      color: white;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
  `
}

customElements.define('batch-result', BatchResult)
