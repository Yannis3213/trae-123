import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrderService, WarningResponse, TransportOrder, BatchResultItem } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-warnings',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2 class="page-title">到期预警</h2>
      </div>

      <div class="stat-row">
        <div class="stat-card stat-normal">
          <div class="stat-num">{{ data()?.normal?.count || 0 }}</div>
          <div class="stat-label">正常</div>
        </div>
        <div class="stat-card stat-approaching">
          <div class="stat-num">{{ data()?.approaching?.count || 0 }}</div>
          <div class="stat-label">临期（3天内）</div>
        </div>
        <div class="stat-card stat-overdue">
          <div class="stat-num">{{ data()?.overdue?.count || 0 }}</div>
          <div class="stat-label">已逾期</div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab-btn" [class.active]="activeTab === 'overdue'" (click)="activeTab = 'overdue'">
          已逾期 ({{ data()?.overdue?.count || 0 }})
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'approaching'" (click)="activeTab = 'approaching'">
          临期 ({{ data()?.approaching?.count || 0 }})
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'normal'" (click)="activeTab = 'normal'">
          正常 ({{ data()?.normal?.count || 0 }})
        </button>
      </div>

      <div class="card" *ngIf="activeGroup()">
        <div class="batch-bar" *ngIf="selectedIds().length > 0">
          <span>已选择 {{ selectedIds().length }} 条订单</span>
          <div class="batch-actions">
            <select [(ngModel)]="batchAction">
              <option value="通过">批量推进</option>
              <option value="退回补正">批量退回补正</option>
            </select>
            <button class="btn btn-primary btn-sm" (click)="doBatch()" [disabled]="batchLoading()">
              {{ batchLoading() ? '处理中...' : '执行' }}
            </button>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">
                <input type="checkbox" [checked]="isAllSelected()" (change)="toggleAll()" />
              </th>
              <th>订单号</th>
              <th>状态</th>
              <th>优先级</th>
              <th>责任人</th>
              <th>当前处理人</th>
              <th>货物</th>
              <th>截止时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of activeGroup()?.orders">
              <td>
                <input type="checkbox"
                  [checked]="selectedIds().includes(o.id)"
                  (change)="toggleSelect(o)"
                  [disabled]="o.current_handler !== authService.currentUser()?.full_name" />
              </td>
              <td><a class="order-link" [routerLink]="['/orders', o.id]">{{ o.order_no }}</a></td>
              <td>
                <span class="status-tag" [ngClass]="getStatusClass(o)">
                  {{ o.is_overdue ? '逾期' : '' }}{{ o.status }}
                </span>
              </td>
              <td><span class="priority-{{ o.priority === '高' ? 'high' : o.priority === '中' ? 'medium' : 'low' }}">{{ o.priority }}</span></td>
              <td>{{ o.responsible_person }}</td>
              <td [class.handler-me]="o.current_handler === authService.currentUser()?.full_name">
                {{ o.current_handler }}
                <span *ngIf="o.current_handler === authService.currentUser()?.full_name" class="me-tag">（我）</span>
              </td>
              <td>{{ o.cargo_name || '-' }}</td>
              <td [class.overdue-text]="o.is_overdue">{{ formatDate(o.deadline) }}</td>
              <td><a class="btn-link" [routerLink]="['/orders', o.id]">补正</a></td>
            </tr>
            <tr *ngIf="!activeGroup()?.orders?.length">
              <td colspan="9" class="empty-cell">暂无订单</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-overlay" *ngIf="showResultModal" (click.self)="showResultModal = false">
        <div class="modal-card modal-large">
          <div class="modal-header">
            <h3>批量处理结果</h3>
            <button class="btn-close" (click)="showResultModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <div class="result-summary">
              <span class="result-success">成功 {{ results().filter(r => r.success).length }}</span>
              <span class="result-failed">失败 {{ results().filter(r => !r.success).length }}</span>
              <span class="result-total">共 {{ results().length }} 条</span>
            </div>
            <table class="data-table result-table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>结果</th>
                  <th>失败原因（逐条）</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of results()">
                  <td>{{ r.order_no }}</td>
                  <td>
                    <span class="status-tag" [ngClass]="r.success ? 'status-completed' : 'status-overdue'">
                      {{ r.success ? '成功' : '失败' }}
                    </span>
                  </td>
                  <td>{{ r.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" (click)="closeResult()">关闭</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1400px; margin: 0 auto; }
    .page-header { margin-bottom: 20px; }
    .page-title { font-size: 20px; font-weight: 600; }
    .stat-row { display: flex; gap: 16px; margin-bottom: 20px; }
    .stat-card { flex: 1; padding: 20px; border-radius: 6px; background: #fff; text-align: center; }
    .stat-normal { border-top: 3px solid #52c41a; }
    .stat-approaching { border-top: 3px solid #faad14; }
    .stat-overdue { border-top: 3px solid #ff4d4f; }
    .stat-num { font-size: 28px; font-weight: 700; }
    .stat-normal .stat-num { color: #389e0d; }
    .stat-approaching .stat-num { color: #d46b08; }
    .stat-overdue .stat-num { color: #cf1322; }
    .stat-label { font-size: 13px; color: #666; margin-top: 4px; }
    .tabs { display: flex; gap: 4px; margin-bottom: 16px; }
    .tab-btn {
      padding: 8px 20px; border: 1px solid #d9d9d9; background: #fff;
      border-radius: 4px 4px 0 0; font-size: 13px; cursor: pointer;
    }
    .tab-btn.active { background: #1677ff; color: #fff; border-color: #1677ff; }
    .card { background: #fff; border-radius: 6px; padding: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
    .batch-bar {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; background: #e6f4ff; border-radius: 4px; margin-bottom: 12px;
    }
    .batch-actions { display: flex; gap: 8px; align-items: center; }
    .batch-actions select { padding: 4px 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 12px; }
    .data-table { width: 100%; font-size: 13px; }
    .data-table th { background: #fafafa; padding: 10px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; font-weight: 600; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid #f5f5f5; }
    .data-table tbody tr:hover { background: #fafafa; }
    .empty-cell { text-align: center; color: #999; padding: 40px !important; }
    .overdue-text { color: #cf1322; font-weight: 600; }
    .order-link { color: #1677ff; font-weight: 500; }
    .order-link:hover { text-decoration: underline; }
    .btn-link { color: #1677ff; }
    .btn-link:hover { text-decoration: underline; }
    .handler-me { color: #1677ff; font-weight: 600; }
    .me-tag { font-size: 12px; color: #1677ff; }
    .btn { padding: 6px 16px; border: 1px solid #d9d9d9; background: #fff; border-radius: 4px; font-size: 13px; cursor: pointer; }
    .btn:hover { border-color: #1677ff; color: #1677ff; }
    .btn-primary { background: #1677ff; color: #fff; border-color: #1677ff; }
    .btn-primary:hover { background: #4096ff; color: #fff; border-color: #4096ff; }
    .btn-primary:disabled { background: #91caff; cursor: not-allowed; color: #fff; border-color: #91caff; }
    .btn-sm { padding: 4px 12px; font-size: 12px; }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-card { background: #fff; border-radius: 8px; width: 90%; max-width: 720px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
    .modal-large { max-width: 800px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
    .modal-header h3 { font-size: 16px; font-weight: 600; }
    .btn-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; line-height: 1; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .modal-footer { padding: 12px 20px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; }
    .result-summary { display: flex; gap: 24px; margin-bottom: 16px; padding: 12px 16px; background: #fafafa; border-radius: 4px; }
    .result-success { color: #389e0d; font-weight: 600; }
    .result-failed { color: #cf1322; font-weight: 600; }
    .result-total { color: #666; }
    .result-table { margin-top: 8px; }
  `]
})
export class WarningsComponent implements OnInit {
  data = signal<WarningResponse | null>(null);
  activeTab: 'normal' | 'approaching' | 'overdue' = 'overdue';
  selectedIds = signal<number[]>([]);
  batchAction = '通过';
  batchLoading = signal(false);
  showResultModal = false;
  results = signal<BatchResultItem[]>([]);

  constructor(
    private orderService: OrderService,
    public authService: AuthService,
  ) {}

  ngOnInit() { this.loadData(); }

  loadData() {
    this.orderService.getWarnings().subscribe({
      next: d => { this.data.set(d); this.selectedIds.set([]); },
      error: err => console.error(err),
    });
  }

  activeGroup() {
    if (!this.data()) return null;
    switch (this.activeTab) {
      case 'normal': return this.data()!.normal;
      case 'approaching': return this.data()!.approaching;
      case 'overdue': return this.data()!.overdue;
    }
  }

  formatDate(s: string) {
    try { return new Date(s).toLocaleString('zh-CN'); } catch { return s; }
  }

  getStatusClass(o: TransportOrder): string {
    if (o.is_overdue) return 'status-overdue';
    if (o.status === '待补正') return 'status-pending';
    if (o.status === '复核中') return 'status-reviewing';
    return 'status-completed';
  }

  isAllSelected() {
    const list = this.activeGroup()?.orders || [];
    const mine = list.filter(o => o.current_handler === this.authService.currentUser()?.full_name);
    return mine.length > 0 && mine.every(o => this.selectedIds().includes(o.id));
  }

  toggleAll() {
    const list = this.activeGroup()?.orders || [];
    const mine = list.filter(o => o.current_handler === this.authService.currentUser()?.full_name);
    if (this.isAllSelected()) {
      this.selectedIds.set(this.selectedIds().filter(id => !mine.find(o => o.id === id)));
    } else {
      const ids = [...new Set([...this.selectedIds(), ...mine.map(o => o.id)])];
      this.selectedIds.set(ids);
    }
  }

  toggleSelect(o: TransportOrder) {
    const cur = this.selectedIds();
    if (cur.includes(o.id)) {
      this.selectedIds.set(cur.filter(id => id !== o.id));
    } else {
      this.selectedIds.set([...cur, o.id]);
    }
  }

  doBatch() {
    if (this.selectedIds().length === 0) return;
    this.batchLoading.set(true);
    this.orderService.batchProcess({
      order_ids: this.selectedIds(),
      action: this.batchAction,
    }).subscribe({
      next: res => {
        this.batchLoading.set(false);
        this.results.set(res.results);
        this.showResultModal = true;
        this.loadData();
      },
      error: err => {
        this.batchLoading.set(false);
        alert('批量处理失败：' + (err?.error?.detail || err?.message || '未知错误'));
      }
    });
  }

  closeResult() {
    this.showResultModal = false;
    this.results.set([]);
  }
}
