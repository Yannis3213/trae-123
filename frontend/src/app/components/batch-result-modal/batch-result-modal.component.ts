import { Component, Input, Output, EventEmitter } from '@angular/core';
import { BatchResult } from '../../models/launch-plan';

@Component({
  selector: 'app-batch-result-modal',
  template: `
    <div class="modal-overlay" (click.self)="close.emit()">
      <div class="modal" style="width:720px;max-width:92vw">
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
              <div class="label">成功</div>
              <div class="value" style="color:#15803d;font-size:24px">{{result.success}}</div>
            </div>
            <div class="stat-card" style="flex:1;background:#fef2f2">
              <div class="label">失败 / 拦截</div>
              <div class="value" style="color:#b91c1c;font-size:24px">{{result.failed}}</div>
            </div>
          </div>

          <div class="section-title">逐条明细</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>计划单号</th>
                <th>客户名称</th>
                <th>结果</th>
                <th>成功/失败原因</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of result.items">
                <td style="font-weight:600">{{item.plan_no || item.id}}</td>
                <td>{{item.customer_name || '-'}}</td>
                <td>
                  <span *ngIf="item.success" class="tag tag-success">✅ 成功</span>
                  <span *ngIf="!item.success" class="tag tag-danger">❌ 失败</span>
                </td>
                <td style="max-width:380px">{{item.reason}}</td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="result.failed > 0" class="alert alert-warning mt-md">
            💡 提示：失败 / 被拦截的单据请在详情页逐项处理补正，系统已在处理记录中留下补正动作和异常原因。
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
  `],
})
export class BatchResultModalComponent {
  @Input() result!: BatchResult;
  @Output() close = new EventEmitter();
}
