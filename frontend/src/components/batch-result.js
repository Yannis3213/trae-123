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
  `
}

customElements.define('batch-result', BatchResult)
