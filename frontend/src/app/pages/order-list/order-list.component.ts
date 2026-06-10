import { Component, OnInit, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService, TransportOrder, BatchResultItem, OrderListFilter } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2 class="page-title">{{ pageTitle }}</h2>
        <div class="page-actions">
          <button class="btn btn-primary" (click)="showBatchModal = true" [disabled]="selectedIds().length === 0">
            批量处理 ({{ selectedIds().length }})
          </button>
        </div>
      </div>

      <div class="filter-bar card">
        <div class="filter-row">
          <div class="filter-item">
            <label>状态</label>
            <select [(ngModel)]="filter.status" (ngModelChange)="loadOrders()">
              <option value="">全部</option>
              <option value="待补正">待补正</option>
              <option value="复核中">复核中</option>
              <option value="办结">办结</option>
            </select>
          </div>
          <div class="filter-item">
            <label>责任人</label>
            <select [(ngModel)]="filter.responsible_person" (ngModelChange)="loadOrders()">
              <option value="">全部</option>
              <option value="张客服">张客服</option>
              <option value="李调度">李调度</option>
              <option value="王运营">王运营</option>
            </select>
          </div>
          <div class="filter-item">
            <label>优先级</label>
            <select [(ngModel)]="filter.priority" (ngModelChange)="loadOrders()">
              <option value="">全部</option>
              <option value="高">高</option>
              <option value="中">中</option>
              <option value="低">低</option>
            </select>
          </div>
          <div class="filter-item">
            <label>截止从</label>
            <input type="date" [(ngModel)]="filter.deadline_from" (ngModelChange)="loadOrders()" />
          </div>
          <div class="filter-item">
            <label>截止至</label>
            <input type="date" [(ngModel)]="filter.deadline_to" (ngModelChange)="loadOrders()" />
          </div>
          <div class="filter-item">
            <button class="btn" (click)="resetFilter()">重置</button>
          </div>
        </div>
      </div>

      <div class="card">
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
              <th>委托方</th>
              <th>收货方</th>
              <th>货物名称</th>
              <th>截止时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let order of orders()" [class.my-row]="isMyHandler(order)">
              <td>
                <input type="checkbox"
                  [checked]="selectedIds().includes(order.id)"
                  (change)="toggleSelect(order)"
                  [disabled]="!canProcess(order)" />
              </td>
              <td><a class="order-link" [routerLink]="['/orders', order.id]">{{ order.order_no }}</a></td>
              <td>
                <span class="status-tag" [ngClass]="getStatusClass(order)">
                  {{ order.is_overdue ? '逾期' : '' }}{{ order.status }}
                </span>
              </td>
              <td><span class="priority-{{ order.priority === '高' ? 'high' : order.priority === '中' ? 'medium' : 'low' }}">{{ order.priority }}</span></td>
              <td>{{ order.responsible_person }}</td>
              <td class="handler-cell">
                {{ order.current_handler }}
                <span *ngIf="isMyHandler(order)" class="me-tag">（我）</span>
              </td>
              <td>{{ order.consignor_name || '-' }}</td>
              <td>{{ order.consignee_name || '-' }}</td>
              <td>{{ order.cargo_name || '-' }}</td>
              <td [class.overdue-text]="order.is_overdue">{{ formatDate(order.deadline) }}</td>
              <td>
                <a class="btn-link" [routerLink]="['/orders', order.id]" [class.disabled]="!canProcess(order)">
                  {{ canProcess(order) ? '办理' : '查看' }}
                </a>
              </td>
            </tr>
            <tr *ngIf="orders().length === 0">
              <td colspan="11" class="empty-cell">暂无数据</td>
            </tr>
          </tbody>
        </table>

        <div class="pagination" *ngIf="total() > 0">
          <span class="pagination-info">共 {{ total() }} 条</span>
          <div class="pagination-btns">
            <button class="btn btn-sm" (click)="prevPage()" [disabled]="page() <= 1">上一页</button>
            <span class="page-num">{{ page() }} / {{ totalPages() }}</span>
            <button class="btn btn-sm" (click)="nextPage()" [disabled]="page() >= totalPages()">下一页</button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="showBatchModal" (click.self)="showBatchModal = false">
        <div class="modal-card">
          <div class="modal-header">
            <h3>批量处理订单</h3>
            <button class="btn-close" (click)="showBatchModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <div class="batch-info">
              已选择 <strong>{{ selectedIds().length }}</strong> 条订单进行处理
            </div>
            <div class="form-group">
              <label>处理动作</label>
              <select [(ngModel)]="batchAction">
                <option value="通过">通过 / 提交到下一环节</option>
                <option value="退回补正">退回补正</option>
                <option value="核验">仅核验</option>
              </select>
            </div>
            <div class="form-group">
              <label>处理备注</label>
              <textarea [(ngModel)]="batchRemark" rows="3" placeholder="可选"></textarea>
            </div>
            <div class="form-group" *ngIf="authService.isOperationsManager()">
              <label>
                <input type="checkbox" [(ngModel)]="useVersionCheck" />
                启用版本校验（防止重复提交/状态冲突）
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" (click)="showBatchModal = false">取消</button>
            <button class="btn btn-primary" (click)="executeBatch()" [disabled]="batchLoading()">
              {{ batchLoading() ? '处理中...' : '确认处理' }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="showResultModal" (click.self)="showResultModal = false">
        <div class="modal-card modal-large">
          <div class="modal-header">
            <h3>批量处理结果</h3>
            <button class="btn-close" (click)="closeResult()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="result-summary">
              <span class="result-success">成功 {{ batchResults().filter(r => r.success).length }}</span>
              <span class="result-failed">失败 {{ batchResults().filter(r => !r.success).length }}</span>
              <span class="result-total">共计 {{ batchResults().length }}</span>
            </div>
            <table class="data-table result-table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>结果</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of batchResults()">
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
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .page-title { font-size: 20px; font-weight: 600; }
    .card { background: #fff; border-radius: 6px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
    .filter-bar { padding: 16px 20px; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
    .filter-item { display: flex; flex-direction: column; gap: 4px; }
    .filter-item label { font-size: 12px; color: #666; }
    .filter-item select, .filter-item input {
      padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; min-width: 140px;
    }
    .data-table { width: 100%; font-size: 13px; }
    .data-table th { background: #fafafa; padding: 10px 12px; text-align: left; border-bottom: 1px solid #f0f0f0; color: #000000d9; font-weight: 600; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid #f5f5f5; }
    .data-table tbody tr:hover { background: #fafafa; }
    .empty-cell { text-align: center; color: #999; padding: 40px !important; }
    .overdue-text { color: #cf1322; font-weight: 500; }
    .order-link { color: #1677ff; font-weight: 500; }
    .order-link:hover { text-decoration: underline; }
    .btn-link { color: #1677ff; }
    .btn-link:hover { text-decoration: underline; }
    .btn { padding: 6px 16px; border: 1px solid #d9d9d9; background: #fff; border-radius: 4px; font-size: 13px; cursor: pointer; }
    .btn:hover { border-color: #1677ff; color: #1677ff; }
    .btn-primary { background: #1677ff; color: #fff; border-color: #1677ff; }
    .btn-primary:hover { background: #4096ff; color: #fff; border-color: #4096ff; }
    .btn-primary:disabled { background: #91caff; border-color: #91caff; cursor: not-allowed; color: #fff; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .btn:disabled { cursor: not-allowed; color: #bfbfbf; border-color: #d9d9d9; }
    .pagination { display: flex; justify-content: space-between; align-items: center; padding: 16px 0 0; }
    .pagination-info { color: #666; font-size: 13px; }
    .pagination-btns { display: flex; gap: 8px; align-items: center; }
    .page-num { font-size: 13px; color: #666; }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-card { background: #fff; border-radius: 8px; width: 90%; max-width: 520px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
    .modal-large { max-width: 720px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
    .modal-header h3 { font-size: 16px; font-weight: 600; }
    .btn-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; line-height: 1; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .modal-footer { padding: 12px 20px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 8px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #333; }
    .form-group select, .form-group textarea, .form-group input {
      width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;
    }
    .form-group textarea { resize: vertical; }
    .batch-info { padding: 12px 16px; background: #e6f4ff; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
    .batch-info strong { color: #1677ff; }
    .result-summary { display: flex; gap: 24px; margin-bottom: 16px; padding: 12px 16px; background: #fafafa; border-radius: 4px; }
    .result-success { color: #389e0d; font-weight: 600; }
    .result-failed { color: #cf1322; font-weight: 600; }
    .result-total { color: #666; }
    .result-table { margin-top: 8px; }
    .my-row { background: #f6ffed !important; }
    .my-row:hover { background: #d9f7be !important; }
    .handler-cell { font-weight: 500; }
    .me-tag { color: #1677ff; font-size: 12px; margin-left: 4px; font-weight: 600; }
    .btn-link.disabled { color: #bfbfbf; cursor: not-allowed; text-decoration: none; pointer-events: none; }
  `]
})
export class OrderListComponent implements OnInit, OnDestroy {
  orders = signal<TransportOrder[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 20;
  selectedIds = signal<number[]>([]);
  filter: OrderListFilter = { page: 1, page_size: 20 };
  showBatchModal = false;
  showResultModal = false;
  batchAction = '通过';
  batchRemark = '';
  batchLoading = signal(false);
  batchResults = signal<BatchResultItem[]>([]);
  useVersionCheck = true;
  private sub: any;
  private tab = '';

  constructor(
    private orderService: OrderService,
    public authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  get pageTitle(): string {
    if (this.tab === 'review') return '过程核验';
    if (this.tab === 'archive') return '复核归档';
    return '运输订单登记';
  }

  totalPages() { return Math.ceil(this.total() / this.pageSize) || 1; }

  ngOnInit() {
    this.sub = this.route.queryParams.subscribe(qp => {
      this.tab = qp['tab'] || '';
      if (this.tab === 'review') {
        this.filter.status = '复核中';
      } else if (this.tab === 'archive') {
        this.filter.status = '办结';
      }
      this.loadOrders();
    });
  }

  ngOnDestroy() { if (this.sub) this.sub.unsubscribe(); }

  loadOrders() {
    this.filter.page = this.page();
    this.filter.page_size = this.pageSize;
    this.orderService.listOrders(this.filter).subscribe({
      next: res => {
        this.orders.set(res.items);
        this.total.set(res.total);
        const existIds = new Set(res.items.map(o => o.id));
        this.selectedIds.set(this.selectedIds().filter(id => existIds.has(id)));
      },
      error: err => console.error('加载订单失败', err),
    });
  }

  resetFilter() {
    this.filter = { page: 1, page_size: this.pageSize };
    if (this.tab === 'review') this.filter.status = '复核中';
    else if (this.tab === 'archive') this.filter.status = '办结';
    this.page.set(1);
    this.loadOrders();
  }

  prevPage() { if (this.page() > 1) { this.page.set(this.page() - 1); this.loadOrders(); } }
  nextPage() { if (this.page() < this.totalPages()) { this.page.set(this.page() + 1); this.loadOrders(); } }

  isAllSelected() {
    const mine = this.orders().filter(o => this.canProcess(o));
    return mine.length > 0 && mine.every(o => this.selectedIds().includes(o.id));
  }

  toggleAll() {
    const mine = this.orders().filter(o => this.canProcess(o));
    if (this.isAllSelected()) {
      this.selectedIds.set(this.selectedIds().filter(id => !mine.find(o => o.id === id)));
    } else {
      const ids = [...new Set([...this.selectedIds(), ...mine.map(o => o.id)])];
      this.selectedIds.set(ids);
    }
  }

  toggleSelect(order: TransportOrder) {
    if (!this.canProcess(order)) return;
    const cur = this.selectedIds();
    if (cur.includes(order.id)) {
      this.selectedIds.set(cur.filter(id => id !== order.id));
    } else {
      this.selectedIds.set([...cur, order.id]);
    }
  }

  isMyHandler(order: TransportOrder): boolean {
    return order.current_handler === this.authService.currentUser()?.full_name;
  }

  canProcess(order: TransportOrder): boolean {
    if (order.status === '办结') return false;
    return this.isMyHandler(order);
  }

  getStatusClass(order: TransportOrder): string {
    if (order.is_overdue) return 'status-overdue';
    if (order.status === '待补正') return 'status-pending';
    if (order.status === '复核中') return 'status-reviewing';
    if (order.status === '办结') return 'status-completed';
    return '';
  }

  formatDate(s: string) {
    try { return new Date(s).toLocaleString('zh-CN'); } catch { return s; }
  }

  executeBatch() {
    if (this.selectedIds().length === 0) return;
    this.batchLoading.set(true);

    const expectedVersions: Record<string, number> = {};
    if (this.useVersionCheck) {
      for (const o of this.orders()) {
        if (this.selectedIds().includes(o.id)) {
          expectedVersions[String(o.id)] = o.version;
        }
      }
    }

    this.orderService.batchProcess({
      order_ids: this.selectedIds(),
      action: this.batchAction,
      remark: this.batchRemark,
      expected_versions: this.useVersionCheck ? expectedVersions : undefined,
    }).subscribe({
      next: res => {
        this.batchLoading.set(false);
        this.showBatchModal = false;
        this.batchResults.set(res.results);
        this.showResultModal = true;
        this.selectedIds.set([]);
        this.loadOrders();
      },
      error: err => {
        this.batchLoading.set(false);
        alert('批量处理失败：' + (err?.error?.detail || err?.message || '未知错误'));
      }
    });
  }

  closeResult() {
    this.showResultModal = false;
    this.batchResults.set([]);
  }
}
