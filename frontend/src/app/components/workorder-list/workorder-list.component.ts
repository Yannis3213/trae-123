import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import {
  WorkOrder, WorkOrderStatus, WarningLevel,
  STATUS_LABELS, WARNING_LABELS, WARNING_COLORS,
  BatchOperationRequest, BatchOperationResponse, BatchResultItem
} from '../../models/models';

@Component({
  selector: 'app-workorder-list',
  template: `
    <div>
      <div style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px">
        <div style="display:flex;gap:15px;flex-wrap:wrap;align-items:center">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="color:#666;font-size:13px">状态:</label>
            <select [(ngModel)]="filters.status" (change)="loadList()"
              style="padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px">
              <option value="">全部</option>
              <option value="correction">待补正</option>
              <option value="pending_review">复核中</option>
              <option value="completed">办结</option>
              <option value="pending_audit">待审核</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="color:#666;font-size:13px">预约进厂:</label>
            <input type="text" [(ngModel)]="filters.appointment_clue" (keyup.enter)="loadList()"
              placeholder="输入预约线索号"
              style="padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;width:180px">
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="color:#666;font-size:13px">预警级别:</label>
            <select [(ngModel)]="filters.warning_level" (change)="loadList()"
              style="padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px">
              <option value="">全部</option>
              <option value="normal">正常</option>
              <option value="near_due">临期</option>
              <option value="overdue">逾期</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="color:#666;font-size:13px">车牌号:</label>
            <input type="text" [(ngModel)]="filters.license_plate" (keyup.enter)="loadList()"
              placeholder="输入车牌号"
              style="padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;width:150px">
          </div>
          <button (click)="loadList()"
            style="padding:8px 20px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer">
            🔍 查询
          </button>
          <button (click)="resetFilters()"
            style="padding:8px 20px;background:#fff;color:#666;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer">
            重置
          </button>
        </div>
      </div>

      <div *ngIf="showBatch && moduleType !== 'ledger'" style="background:#fff;padding:15px 20px;border-radius:8px;margin-bottom:15px;display:flex;align-items:center;gap:15px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" [checked]="allSelected" (change)="toggleAll()"
            style="width:16px;height:16px">
          <span style="color:#666">全选 ({{selectedIds.length}}/{{orders.length}})</span>
        </label>
        <select *ngIf="batchActions.length > 0" [(ngModel)]="selectedBatchAction"
          style="padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px">
          <option value="">选择批量操作</option>
          <option *ngFor="let action of batchActions" [value]="action.value">
            {{action.label}}
          </option>
        </select>
        <input *ngIf="selectedBatchAction && needAuditNote" type="text"
          [(ngModel)]="batchAuditNote" placeholder="请输入审核备注"
          style="padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px;flex:1;min-width:300px">
        <button *ngIf="selectedBatchAction && selectedIds.length > 0" (click)="executeBatch()"
          [disabled]="batchLoading"
          style="padding:8px 20px;background:#52c41a;color:#fff;border:none;border-radius:4px;cursor:pointer">
          {{batchLoading ? '处理中...' : '批量处理'}}
        </button>
      </div>

      <div *ngIf="batchResult" style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px;border:2px solid #1890ff">
        <h4 style="margin:0 0 15px 0;color:#1890ff">
          批量处理结果 - 共{{batchResult.total}}条，成功{{batchResult.success}}条，失败{{batchResult.failed}}条
        </h4>
        <div style="max-height:200px;overflow:auto">
          <div *ngFor="let item of batchResult.results" style="padding:8px;border-bottom:1px solid #f0f0f0;font-size:13px">
            <span style="margin-right:15px">工单ID: {{item.id}}</span>
            <span [style.color]="item.success ? '#52c41a' : '#ff4d4f'" style="font-weight:bold">
              {{item.success ? '✅ 成功' : '❌ 失败'}}
            </span>
            <span style="margin-left:15px;color:#888">{{item.message}}</span>
          </div>
        </div>
        <button (click)="batchResult = null; loadList()"
          style="margin-top:10px;padding:6px 16px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer">
          关闭并刷新
        </button>
      </div>

      <div style="background:#fff;border-radius:8px;overflow:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#fafafa">
              <th *ngIf="showBatch && moduleType !== 'ledger'" style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0;width:50px"></th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">工单号</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">预约线索</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">客户信息</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">车辆信息</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">状态</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">预警</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">当前处理人</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">预计完成</th>
              <th style="padding:12px;text-align:left;border-bottom:1px solid #f0f0f0">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let order of orders" style="cursor:pointer" (mouseenter)="order.hover = true" (mouseleave)="order.hover = false"
              [style.background]="order.hover ? '#f5f5f5' : '#fff'">
              <td *ngIf="showBatch && moduleType !== 'ledger'" style="padding:12px;border-bottom:1px solid #f0f0f0">
                <input type="checkbox" [checked]="selectedIds.includes(order.id)" (change)="toggleSelect(order.id)"
                  (click)="$event.stopPropagation()" style="width:16px;height:16px">
              </td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0;font-family:monospace;color:#1890ff">{{order.order_no}}</td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0;color:#666">{{order.appointment_clue}}</td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0">
                <div>{{order.customer_name}}</div>
                <div style="font-size:12px;color:#999">{{order.phone}}</div>
              </td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0">
                <div>{{order.license_plate}}</div>
                <div style="font-size:12px;color:#999">{{order.car_model}} / {{order.mileage}}km</div>
              </td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0">
                <span [style.background]="getStatusBg(order.status)" [style.color]="getStatusColor(order.status)"
                  style="padding:4px 12px;border-radius:12px;font-size:12px">
                  {{STATUS_LABELS[order.status]}}
                </span>
              </td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0">
                <span [style.color]="WARNING_COLORS[order.warning_level]" style="font-weight:bold;font-size:13px">
                  {{WARNING_LABELS[order.warning_level]}}
                </span>
              </td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0;color:#666">{{order.current_handler_name}}</td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0;color:#666;font-size:13px">
                {{formatDate(order.expected_complete_at)}}
              </td>
              <td style="padding:12px;border-bottom:1px solid #f0f0f0">
                <button (click)="viewDetail(order.id); $event.stopPropagation()"
                  style="padding:4px 12px;background:#e6f7ff;color:#1890ff;border:none;border-radius:4px;cursor:pointer;font-size:12px">
                  详情
                </button>
              </td>
            </tr>
            <tr *ngIf="orders.length === 0">
              <td [attr.colspan]="showBatch && moduleType !== 'ledger' ? 10 : 9" style="padding:60px;text-align:center;color:#999">
                暂无数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;color:#666;font-size:13px">
        <div>共 {{total}} 条记录</div>
        <div style="display:flex;gap:8px">
          <button (click)="changePage(page - 1)" [disabled]="page === 1"
            style="padding:6px 12px;border:1px solid #d9d9d9;background:#fff;border-radius:4px;cursor:pointer">
            上一页
          </button>
          <span style="padding:6px 12px">第 {{page}} 页</span>
          <button (click)="changePage(page + 1)" [disabled]="page * pageSize >= total"
            style="padding:6px 12px;border:1px solid #d9d9d9;background:#fff;border-radius:4px;cursor:pointer">
            下一页
          </button>
        </div>
      </div>
    </div>
  `
})
export class WorkorderListComponent implements OnInit {
  @Input() moduleType: 'registration' | 'verification' | 'review' | 'warning' | 'ledger' = 'registration';
  @Input() defaultStatus: WorkOrderStatus | '' = '';
  @Input() warningFilter: WarningLevel | '' = '';
  @Output() refresh = new EventEmitter();

  orders: (WorkOrder & { hover?: boolean })[] = [];
  total = 0;
  page = 1;
  pageSize = 20;

  filters = {
    status: '',
    appointment_clue: '',
    warning_level: '',
    license_plate: ''
  };

  selectedIds: number[] = [];
  allSelected = false;
  selectedBatchAction = '';
  batchAuditNote = '';
  batchLoading = false;
  batchResult: BatchOperationResponse | null = null;

  STATUS_LABELS = STATUS_LABELS;
  WARNING_LABELS = WARNING_LABELS;
  WARNING_COLORS = WARNING_COLORS;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.filters.status = this.defaultStatus;
    this.filters.warning_level = this.warningFilter;
    this.loadList();
  }

  get showBatch(): boolean {
    return this.moduleType !== 'warning' && this.moduleType !== 'ledger';
  }

  get needAuditNote(): boolean {
    return ['reject', 'send_back'].includes(this.selectedBatchAction);
  }

  get batchActions(): { value: string; label: string }[] {
    const user = this.authService.currentUser;
    if (!user) return [];

    switch (this.moduleType) {
      case 'registration':
        return [
          { value: 'resubmit', label: '批量重新提交审核' }
        ];
      case 'verification':
        return [
          { value: 'approve', label: '批量审核通过' },
          { value: 'reject', label: '批量退回补正' }
        ];
      case 'review':
        return [
          { value: 'archive', label: '批量复核归档' },
          { value: 'send_back', label: '批量退回补正' }
        ];
      default:
        return [];
    }
  }

  loadList(): void {
    this.apiService.getWorkOrderList({
      page: this.page,
      page_size: this.pageSize,
      status: this.filters.status,
      appointment_clue: this.filters.appointment_clue,
      warning_level: this.filters.warning_level,
      license_plate: this.filters.license_plate
    }).subscribe(res => {
      this.orders = res.list;
      this.total = res.total;
      this.selectedIds = [];
      this.allSelected = false;
    });
  }

  resetFilters(): void {
    this.filters = {
      status: this.defaultStatus,
      appointment_clue: '',
      warning_level: this.warningFilter,
      license_plate: ''
    };
    this.page = 1;
    this.loadList();
  }

  changePage(p: number): void {
    this.page = p;
    this.loadList();
  }

  toggleSelect(id: number): void {
    const idx = this.selectedIds.indexOf(id);
    if (idx > -1) {
      this.selectedIds.splice(idx, 1);
    } else {
      this.selectedIds.push(id);
    }
    this.allSelected = this.selectedIds.length === this.orders.length && this.orders.length > 0;
  }

  toggleAll(): void {
    this.allSelected = !this.allSelected;
    if (this.allSelected) {
      this.selectedIds = this.orders.map(o => o.id);
    } else {
      this.selectedIds = [];
    }
  }

  executeBatch(): void {
    if (!this.selectedBatchAction || this.selectedIds.length === 0) return;
    if (this.needAuditNote && !this.batchAuditNote.trim()) {
      alert('请输入审核备注');
      return;
    }

    this.batchLoading = true;
    const req: BatchOperationRequest = {
      ids: this.selectedIds,
      action: this.selectedBatchAction,
      audit_note: this.batchAuditNote
    };

    this.apiService.batchProcess(req).subscribe({
      next: res => {
        this.batchResult = res;
        this.batchLoading = false;
        this.selectedBatchAction = '';
        this.batchAuditNote = '';
      },
      error: () => {
        this.batchLoading = false;
      }
    });
  }

  viewDetail(id: number): void {
    this.router.navigate(['/workorder', id]);
  }

  getStatusBg(status: WorkOrderStatus): string {
    const map: Record<WorkOrderStatus, string> = {
      draft: '#f5f5f5',
      pending_audit: '#fff7e6',
      pending_review: '#e6f7ff',
      correction: '#fff1f0',
      completed: '#f6ffed',
      rejected: '#fff1f0'
    };
    return map[status];
  }

  getStatusColor(status: WorkOrderStatus): string {
    const map: Record<WorkOrderStatus, string> = {
      draft: '#666',
      pending_audit: '#fa8c16',
      pending_review: '#1890ff',
      correction: '#ff4d4f',
      completed: '#52c41a',
      rejected: '#ff4d4f'
    };
    return map[status];
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
