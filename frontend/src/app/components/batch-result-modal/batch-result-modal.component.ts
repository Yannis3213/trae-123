import { Component, Input, Output, EventEmitter } from '@angular/core';
import { BatchResult, BatchResultItem } from '../../models/launch-plan';

@Component({
  selector: 'app-batch-result-modal',
  template: `
    <div class="modal-overlay" (click.self)="close.emit()">
      <div class="modal" style="width:760px;max-width:92vw">
        <div class="modal-header">
          <span>📊 批量处理结果</span>
          <button class="modal-close" (click)="close.emit()">×</button>
        </div>
        <div class="modal-body">
          <div class="summary flex gap-md wrap mb-md">
            <div class="stat-card" style="flex:1;background:#f0f9ff">
              <div class="label">处理总数</div>
              <div class="value" style="color:#0369a1;font-size:24px">{{result.total}}</div>
            </div>
            <div class="stat-card" style="flex:1;background:#f0f9eb">
              <div class="label">✅ 成功</div>
              <div class="value" style="color:#15803d;font-size:24px">{{result.success}}</div>
            </div>
            <div class="stat-card" style="flex:1;background:#eef2ff">
              <div class="label">✋ 未接办拦截</div>
              <div class="value" style="color:#4338ca;font-size:24px">{{result.not_accepted || 0}}</div>
            </div>
            <div class="stat-card" style="flex:1;background:#fef2f2">
              <div class="label">🚫 逾期拦截</div>
              <div class="value" style="color:#b91c1c;font-size:24px">{{result.overdue_blocked || 0}}</div>
            </div>
            <div class="stat-card" style="flex:1;background:#fff7ed">
              <div class="label">📋 缺证据</div>
              <div class="value" style="color:#c2410c;font-size:24px">{{result.missing_evidence || 0}}</div>
            </div>
            <div class="stat-card" style="flex:1;background:#fef2f2">
              <div class="label">❌ 其他失败</div>
              <div class="value" style="color:#991b1b;font-size:24px">{{otherFailed}}</div>
            </div>
          </div>

          <div class="section-title">逐条明细</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>计划单号</th>
                <th>客户名称</th>
                <th>结果类型</th>
                <th>原因</th>
                <th>补正提示</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of result.items" [ngClass]="rowClass(item)">
                <td style="font-weight:600">{{item.plan_no || item.id}}</td>
                <td>{{item.customer_name || '-'}}</td>
                <td>
                  <span *ngIf="item.result_type === 'success'" class="tag tag-success">✅ 成功</span>
                  <span *ngIf="item.result_type === 'overdue_blocked'" class="tag tag-danger">🚫 逾期拦截</span>
                  <span *ngIf="item.result_type === 'missing_evidence'" class="tag tag-warning">📋 缺证据</span>
                  <span *ngIf="item.result_type === 'not_accepted'" class="tag tag-info">✋ 未接办拦截</span>
                  <span *ngIf="item.result_type === 'blocked'" class="tag tag-info">⛔ 批量拦截</span>
                  <span *ngIf="item.result_type === 'error'" class="tag tag-danger">❌ 失败</span>
                  <span *ngIf="!item.result_type && item.success" class="tag tag-success">✅ 成功</span>
                  <span *ngIf="!item.result_type && !item.success" class="tag tag-danger">❌ 失败</span>
                </td>
                <td style="max-width:260px">{{item.reason}}</td>
                <td style="max-width:200px">
                  <span *ngIf="item.correction_hint" style="color:#c2410c;font-size:12px">
                    💡 {{item.correction_hint}}
                  </span>
                  <span *ngIf="!item.correction_hint" style="color:var(--text-secondary)">-</span>
                </td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="(result.not_accepted || 0) > 0 || (result.overdue_blocked || 0) > 0 || (result.missing_evidence || 0) > 0" class="alert alert-warning mt-md">
            💡 提示：被拦截（未接办/逾期/缺证据）的单据请在详情页逐项补正后重新提交，系统已在处理记录和审计备注中留下补正动作和异常原因。
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" (click)="close.emit()">确定</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .data-table th, .data-table td {
      padding: 10px 8px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .data-table th { background: var(--bg-light); }
    tr.row-blocked td { background: #fef2f2; }
    tr.row-missing td { background: #fff7ed; }
    tr.row-notaccepted td { background: #eef2ff; }
  `],
})
export class BatchResultModalComponent {
  @Input() result!: BatchResult;
  @Output() close = new EventEmitter();

  get otherFailed(): number {
    return this.result.failed
      - (this.result.overdue_blocked || 0)
      - (this.result.missing_evidence || 0)
      - (this.result.not_accepted || 0);
  }

  rowClass(item: BatchResultItem) {
    if (item.result_type === 'overdue_blocked') return 'row-blocked';
    if (item.result_type === 'missing_evidence') return 'row-missing';
    if (item.result_type === 'not_accepted') return 'row-notaccepted';
    return '';
  }
}
