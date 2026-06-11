import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { BatchResult } from '../../models/loan.model';

const STATUS_NAMES: { [key: string]: string } = {
  DRAFT: '草稿',
  PENDING_VERIFICATION: '待核验',
  VERIFICATION_PASSED: '核验完成',
  VERIFICATION_FAILED: '核验失败',
  CORRECTION_REQUIRED: '退回补正',
  APPROVED: '审批通过',
  REJECTED: '已拒绝',
  COMPLETED: '已完成'
};

@Component({
  selector: 'app-batch-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="batch-result-page">
      <div class="result-header">
        <a class="back-link" routerLink="/">&larr; 返回列表</a>
        <h2>批量处理结果</h2>
      </div>

      <div class="result-summary" *ngIf="result">
        <div class="summary-card success">
          <div class="summary-value">{{ result.successCount }}</div>
          <div class="summary-label">成功</div>
        </div>
        <div class="summary-card fail">
          <div class="summary-value">{{ result.failCount }}</div>
          <div class="summary-label">失败</div>
        </div>
        <div class="summary-card total">
          <div class="summary-value">{{ result.total }}</div>
          <div class="summary-label">总计</div>
        </div>
      </div>

      <div class="result-table" *ngIf="result">
        <div class="table-title">逐条处理明细</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 60px;">序号</th>
              <th>申请单ID</th>
              <th>处理结果</th>
              <th>新状态</th>
              <th>失败原因</th>
              <th style="width: 100px;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of result.results; let i = index">
              <td>{{ i + 1 }}</td>
              <td>{{ item.id }}</td>
              <td>
                <span class="result-badge" [ngClass]="item.success ? 'success' : 'fail'">
                  {{ item.success ? '成功' : '失败' }}
                </span>
              </td>
              <td>
                <span *ngIf="item.status" class="status-badge"
                      [ngClass]="'status-' + item.status">
                  {{ STATUS_NAMES[item.status] || item.status }}
                </span>
                <span *ngIf="!item.success">-</span>
              </td>
              <td class="fail-reason">
                <span *ngIf="!item.success && item.reason" class="reason-text">
                  {{ item.reason }}
                </span>
                <span *ngIf="item.success">-</span>
              </td>
              <td>
                <a class="action-link" [routerLink]="['/application', item.id]">查看详情</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="result-actions" *ngIf="result">
        <button class="btn-primary" (click)="goBack()">返回列表</button>
        <button class="btn-secondary" (click)="viewFails()" *ngIf="result.failCount > 0">
          只看失败
        </button>
      </div>

      <div class="empty-state" *ngIf="!result">
        <p>暂无批量处理结果</p>
        <a class="back-link" routerLink="/">返回列表</a>
      </div>
    </div>
  `,
  styles: [`
    .batch-result-page { max-width: 900px; margin: 0 auto; }
    .result-header { margin-bottom: 20px; }
    .result-header h2 { margin: 12px 0 0 0; color: #1e3a5f; }
    .back-link { color: #2c5282; text-decoration: none; font-size: 13px; }

    .result-summary {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
      margin-bottom: 24px;
    }
    .summary-card {
      background: white; padding: 24px; border-radius: 8px;
      text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .summary-value { font-size: 32px; font-weight: bold; }
    .summary-label { font-size: 14px; color: #666; margin-top: 4px; }
    .summary-card.success .summary-value { color: #38a169; }
    .summary-card.fail .summary-value { color: #e53e3e; }
    .summary-card.total .summary-value { color: #2c5282; }

    .result-table {
      background: white; border-radius: 8px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .table-title { font-size: 15px; font-weight: 600; color: #1e3a5f; margin-bottom: 16px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      background: #f7fafc; padding: 10px 12px; text-align: left;
      font-size: 13px; color: #4a5568; border-bottom: 1px solid #e2e8f0;
    }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid #edf2f7; font-size: 13px; }

    .result-badge {
      display: inline-block; padding: 4px 12px; border-radius: 12px;
      font-size: 12px; font-weight: 500;
    }
    .result-badge.success { background: #c6f6d5; color: #276749; }
    .result-badge.fail { background: #fed7d7; color: #c53030; }

    .status-badge {
      display: inline-block; padding: 3px 10px; border-radius: 12px;
      font-size: 12px; font-weight: 500;
    }
    .status-DRAFT { background: #edf2f7; color: #4a5568; }
    .status-PENDING_VERIFICATION { background: #bee3f8; color: #2b6cb0; }
    .status-VERIFICATION_PASSED { background: #c6f6d5; color: #276749; }
    .status-VERIFICATION_FAILED { background: #fed7d7; color: #c53030; }
    .status-CORRECTION_REQUIRED { background: #feebc8; color: #c05621; }
    .status-APPROVED { background: #c6f6d5; color: #276749; }
    .status-REJECTED { background: #fed7d7; color: #c53030; }
    .status-COMPLETED { background: #e9d8fd; color: #553c9a; }

    .fail-reason { color: #c53030; }
    .reason-text { font-size: 12px; }
    .action-link { color: #2c5282; cursor: pointer; text-decoration: none; font-size: 13px; }

    .result-actions {
      margin-top: 20px; display: flex; gap: 12px; justify-content: center;
    }
    .btn-primary {
      padding: 10px 24px; background: #2c5282; color: white;
      border: none; border-radius: 4px; cursor: pointer; font-size: 14px;
    }
    .btn-primary:hover { background: #1e3a5f; }
    .btn-secondary {
      padding: 10px 24px; background: white; color: #2c5282;
      border: 1px solid #2c5282; border-radius: 4px; cursor: pointer; font-size: 14px;
    }
    .btn-secondary:hover { background: #f0f7ff; }

    .empty-state {
      text-align: center; padding: 60px 20px; background: white;
      border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .empty-state p { color: #a0aec0; margin: 0 0 12px 0; }
  `]
})
export class BatchResultComponent implements OnInit {
  result: BatchResult | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const saved = sessionStorage.getItem('batchResult');
    if (saved) {
      try {
        this.result = JSON.parse(saved);
      } catch (e) {
        this.result = null;
      }
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  viewFails(): void {
    if (this.result) {
      this.result.results = this.result.results.filter(r => !r.success);
    }
  }

  protected readonly STATUS_NAMES = STATUS_NAMES;
}
