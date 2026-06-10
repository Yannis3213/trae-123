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
          <button class="btn btn-primary" *ngIf="canCreate()" (click)="openCreateModal()">
            + 新建订单
          </button>
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
              <td><a class="order-link" [routerLink]="['/orders', order.id]">{{ order.order_no }}</a>
                <div class="order-summary">
                  <span class="summary-item summary-exc" *ngIf="order.exception_count && order.exception_count > 0">
                    ⚠ {{ order.exception_count }} 个异常
                  </span>
                  <span class="summary-item summary-gap" *ngIf="order.evidence_gap && order.evidence_gap > 0">
                    📎 缺{{ order.evidence_gap }}份证据
                  </span>
                  <span class="summary-item summary-record" *ngIf="order.last_record_summary">
                    {{ order.last_record_summary }}
                  </span>
                  <span class="summary-item summary-note" *ngIf="order.audit_note_count && order.audit_note_count > 0">
                    📝 {{ order.audit_note_count }} 条备注
                  </span>
                </div>
              </td>
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

      <div class="modal-overlay" *ngIf="showCreateModal" (click.self)="closeCreateModal()">
        <div class="modal-card modal-large">
          <div class="modal-header">
            <h3>新建运输订单</h3>
            <button class="btn-close" (click)="closeCreateModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-tip" *ngIf="createError">
              <span class="tip-icon">⚠</span>
              <span>{{ createError }}</span>
            </div>
            <div class="create-form-grid">
              <div class="form-group">
                <label>订单号 <span class="required">*</span></label>
                <input type="text" [(ngModel)]="newForm.order_no" placeholder="如：YT20240601006" />
              </div>
              <div class="form-group">
                <label>优先级</label>
                <select [(ngModel)]="newForm.priority">
                  <option value="高">高</option>
                  <option value="中">中</option>
                  <option value="低">低</option>
                </select>
              </div>
              <div class="form-group">
                <label>责任人 <span class="required">*</span></label>
                <select [(ngModel)]="newForm.responsible_person">
                  <option value="张客服">张客服</option>
                  <option value="李调度">李调度</option>
                  <option value="王运营">王运营</option>
                </select>
              </div>
              <div class="form-group">
                <label>截止时间 <span class="required">*</span></label>
                <input type="datetime-local" [(ngModel)]="newForm.deadline" />
              </div>
              <div class="form-group">
                <label>发货人名称 <span class="required">*</span></label>
                <input type="text" [(ngModel)]="newForm.consignor_name" placeholder="如：上海XX贸易公司" />
              </div>
              <div class="form-group">
                <label>发货人联系人</label>
                <input type="text" [(ngModel)]="newForm.consignor_contact" placeholder="如：张三" />
              </div>
              <div class="form-group">
                <label>发货人电话</label>
                <input type="text" [(ngModel)]="newForm.consignor_phone" placeholder="如：13800138000" />
              </div>
              <div class="form-group">
                <label>收货人名称 <span class="required">*</span></label>
                <input type="text" [(ngModel)]="newForm.consignee_name" placeholder="如：北京XX科技公司" />
              </div>
              <div class="form-group">
                <label>收货人联系人</label>
                <input type="text" [(ngModel)]="newForm.consignee_contact" placeholder="如：李四" />
              </div>
              <div class="form-group">
                <label>收货人电话</label>
                <input type="text" [(ngModel)]="newForm.consignee_phone" placeholder="如：13900139000" />
              </div>
              <div class="form-group">
                <label>货物名称 <span class="required">*</span></label>
                <input type="text" [(ngModel)]="newForm.cargo_name" placeholder="如：电子产品" />
              </div>
              <div class="form-group">
                <label>货物数量</label>
                <input type="text" [(ngModel)]="newForm.cargo_quantity" placeholder="如：100箱" />
              </div>
              <div class="form-group">
                <label>货物重量</label>
                <input type="text" [(ngModel)]="newForm.cargo_weight" placeholder="如：500kg" />
              </div>
              <div class="form-group">
                <label>货物体积</label>
                <input type="text" [(ngModel)]="newForm.cargo_volume" placeholder="如：10m³" />
              </div>
              <div class="form-group">
                <label>起运地 <span class="required">*</span></label>
                <input type="text" [(ngModel)]="newForm.departure" placeholder="如：上海市浦东新区" />
              </div>
              <div class="form-group">
                <label>目的地 <span class="required">*</span></label>
                <input type="text" [(ngModel)]="newForm.destination" placeholder="如：北京市朝阳区" />
              </div>
              <div class="form-group" style="grid-column: span 2;">
                <label>运输要求</label>
                <textarea [(ngModel)]="newForm.transport_requirements" rows="2" placeholder="如：需恒温运输，轻拿轻放"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" (click)="closeCreateModal()">取消</button>
            <button class="btn btn-primary" (click)="submitCreate()" [disabled]="createLoading()">
              {{ createLoading() ? '提交中...' : '创建订单' }}
            </button>
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
    .order-summary { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; color: #8c8c8c; }
    .summary-item { padding: 1px 6px; background: #f5f5f5; border-radius: 3px; }
    .summary-exc { background: #fff1f0; color: #cf1322; }
    .summary-gap { background: #fff7e6; color: #d46b08; }
    .summary-note { background: #e6f4ff; color: #0958d9; }
    .summary-record { color: #595959; background: #f0f0f0; }
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
    .create-form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 20px; }
    .required { color: #cf1322; margin-left: 2px; }
    .form-tip {
      padding: 10px 14px; background: #fff1f0; color: #cf1322;
      border-radius: 4px; margin-bottom: 16px; font-size: 13px;
      border: 1px solid #ffa39e;
    }
    .form-tip .tip-icon { margin-right: 6px; font-weight: bold; }
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
  showCreateModal = false;
  createLoading = signal(false);
  createError = '';
  newForm = this.getDefaultNewForm();
  private sub: any;
  private tab = '';

  getDefaultNewForm() {
    const now = new Date();
    now.setDate(now.getDate() + 7);
    const iso = now.toISOString().slice(0, 16);
    return {
      order_no: '',
      priority: '中',
      responsible_person: this.authService.currentUser()?.full_name || '张客服',
      deadline: iso,
      consignor_name: '',
      consignor_contact: '',
      consignor_phone: '',
      consignee_name: '',
      consignee_contact: '',
      consignee_phone: '',
      cargo_name: '',
      cargo_quantity: '',
      cargo_weight: '',
      cargo_volume: '',
      departure: '',
      destination: '',
      transport_requirements: '',
    };
  }

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

  canCreate(): boolean {
    if (this.tab !== '') return false;
    return this.authService.isCustomerService();
  }

  openCreateModal() {
    this.newForm = this.getDefaultNewForm();
    this.createError = '';
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  validateNewForm(): string | null {
    if (!this.newForm.order_no.trim()) return '请填写订单号';
    if (!this.newForm.responsible_person) return '请选择责任人';
    if (!this.newForm.deadline) return '请选择截止时间';
    if (!this.newForm.consignor_name.trim()) return '请填写发货人名称';
    if (!this.newForm.consignee_name.trim()) return '请填写收货人名称';
    if (!this.newForm.cargo_name.trim()) return '请填写货物名称';
    if (!this.newForm.departure.trim()) return '请填写起运地';
    if (!this.newForm.destination.trim()) return '请填写目的地';
    return null;
  }

  submitCreate() {
    this.createError = '';
    const error = this.validateNewForm();
    if (error) {
      this.createError = '表单校验失败：' + error;
      return;
    }
    this.createLoading.set(true);

    const submitData: any = {
      order_no: this.newForm.order_no.trim(),
      priority: this.newForm.priority,
      responsible_person: this.newForm.responsible_person,
      deadline: new Date(this.newForm.deadline).toISOString(),
    };
    if (this.newForm.consignor_name.trim()) submitData.consignor_name = this.newForm.consignor_name.trim();
    if (this.newForm.consignor_contact.trim()) submitData.consignor_contact = this.newForm.consignor_contact.trim();
    if (this.newForm.consignor_phone.trim()) submitData.consignor_phone = this.newForm.consignor_phone.trim();
    if (this.newForm.consignee_name.trim()) submitData.consignee_name = this.newForm.consignee_name.trim();
    if (this.newForm.consignee_contact.trim()) submitData.consignee_contact = this.newForm.consignee_contact.trim();
    if (this.newForm.consignee_phone.trim()) submitData.consignee_phone = this.newForm.consignee_phone.trim();
    if (this.newForm.cargo_name.trim()) submitData.cargo_name = this.newForm.cargo_name.trim();
    if (this.newForm.cargo_quantity.trim()) submitData.cargo_quantity = this.newForm.cargo_quantity.trim();
    if (this.newForm.cargo_weight.trim()) submitData.cargo_weight = this.newForm.cargo_weight.trim();
    if (this.newForm.cargo_volume.trim()) submitData.cargo_volume = this.newForm.cargo_volume.trim();
    if (this.newForm.departure.trim()) submitData.departure = this.newForm.departure.trim();
    if (this.newForm.destination.trim()) submitData.destination = this.newForm.destination.trim();
    if (this.newForm.transport_requirements.trim()) submitData.transport_requirements = this.newForm.transport_requirements.trim();

    this.orderService.createOrder(submitData).subscribe({
      next: order => {
        this.createLoading.set(false);
        this.showCreateModal = false;
        alert('订单创建成功，即将跳转详情页上传证据');
        this.loadOrders();
        this.router.navigate(['/orders', order.id]);
      },
      error: err => {
        this.createLoading.set(false);
        const detail = err?.error?.detail || err?.message || '未知错误';
        this.createError = '创建失败：' + detail;
      }
    });
  }
}
