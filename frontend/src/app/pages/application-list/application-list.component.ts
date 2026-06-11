import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoanService } from '../../services/loan.service';
import { AuthService } from '../../services/auth.service';
import { LoanApplication, Stats, User } from '../../models/loan.model';

const STATUS_NAMES: { [key: string]: string } = {
  DRAFT: '草稿',
  PENDING_VERIFICATION: '待核验',
  VERIFICATION_PASSED: '核验完成',
  VERIFICATION_FAILED: '核验失败',
  CORRECTION_REQUIRED: '退回补正',
  APPROVED: '审批通过',
  REJECTED: '已拒绝',
  COMPLETED: '已完成',
  ARCHIVED: '已归档'
};

const NODE_NAMES: { [key: string]: string } = {
  APPLICATION: '借款申请',
  VERIFICATION: '资料核验',
  APPROVAL: '审批放款'
};

@Component({
  selector: 'app-application-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="list-page">
      <div class="page-header">
        <h2>借款申请单队列</h2>
        <div class="header-actions">
          <button *ngIf="isCreditOfficer" class="btn-primary" (click)="showCreateModal = true">
            + 新建申请单
          </button>
          <button *ngIf="selectedIds.length > 0 && canBatch" class="btn-secondary" (click)="showBatchModal = true">
            批量处理 ({{ selectedIds.length }})
          </button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card normal" (click)="filterByDue('normal')">
          <div class="stat-value">{{ stats.byDue?.normal || 0 }}</div>
          <div class="stat-label">正常</div>
        </div>
        <div class="stat-card approaching" (click)="filterByDue('approaching')">
          <div class="stat-value">{{ stats.byDue?.approaching || 0 }}</div>
          <div class="stat-label">临期 (3天内)</div>
        </div>
        <div class="stat-card overdue" (click)="filterByDue('overdue')">
          <div class="stat-value">{{ stats.byDue?.overdue || 0 }}</div>
          <div class="stat-label">逾期</div>
        </div>
        <div class="stat-card archived" (click)="filterByArchived('true')">
          <div class="stat-value">{{ stats.archived || 0 }}</div>
          <div class="stat-label">📁 已归档</div>
        </div>
        <div class="stat-card total" (click)="clearDueFilter()">
          <div class="stat-value">{{ stats.total || 0 }}</div>
          <div class="stat-label">全部单据</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <label>状态筛选:</label>
          <select [(ngModel)]="filterStatus" (change)="loadApplications()">
            <option value="">全部状态</option>
            <option *ngFor="let name of statusList" [value]="name.value">{{ name.label }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>节点筛选:</label>
          <select [(ngModel)]="filterNode" (change)="loadApplications()">
            <option value="">全部节点</option>
            <option value="APPLICATION">借款申请</option>
            <option value="VERIFICATION">资料核验</option>
            <option value="APPROVAL">审批放款</option>
          </select>
        </div>
        <div class="filter-group">
          <label>到期状态:</label>
          <select [(ngModel)]="filterDue" (change)="loadApplications()">
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="approaching">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>
        <div class="filter-group">
          <label>归档状态:</label>
          <select [(ngModel)]="filterArchived" (change)="loadApplications()">
            <option value="">全部</option>
            <option value="false">未归档</option>
            <option value="true">已归档</option>
          </select>
        </div>
        <div class="filter-group search">
          <input type="text" [(ngModel)]="keyword" (input)="onSearch()" placeholder="搜索姓名/申请单号/身份证">
        </div>
        <button class="btn-link" (click)="clearFilters()">重置筛选</button>
      </div>

      <div class="content-layout">
        <div class="main-content">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 40px;">
                    <input type="checkbox" [checked]="isAllSelected" (change)="toggleSelectAll()">
                  </th>
                  <th>申请单号</th>
                  <th>申请人</th>
                  <th>金额(元)</th>
                  <th>期限</th>
                  <th>当前节点</th>
                  <th>状态</th>
                  <th>到期状态</th>
                  <th>归档状态</th>
                  <th>核验到期日</th>
                  <th>创建人</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let app of applications"
                    [class.due-overdue]="app.dueStatus === 'overdue'"
                    [class.due-approaching]="app.dueStatus === 'approaching'"
                    [class.row-archived]="app.is_archived === 1 || app.is_archived === true"
                    (click)="goToDetail(app.id)">
                  <td (click)="$event.stopPropagation()">
                    <input type="checkbox" [checked]="selectedIds.includes(app.id)"
                           (change)="toggleSelect(app.id)">
                  </td>
                  <td class="mono">{{ app.application_no }}</td>
                  <td>{{ app.applicant_name }}</td>
                  <td class="amount">{{ app.amount.toLocaleString() }}</td>
                  <td>{{ app.term_months }}个月</td>
                  <td>{{ NODE_NAMES[app.current_node] || app.current_node }}</td>
                  <td>
                    <span class="status-badge" [ngClass]="'status-' + app.status">
                      {{ STATUS_NAMES[app.status] || app.status }}
                    </span>
                  </td>
                  <td>
                    <span class="due-badge" [ngClass]="'due-' + app.dueStatus">
                      {{ dueLabel(app.dueStatus) }}
                    </span>
                  </td>
                  <td>
                    <span *ngIf="app.is_archived === 1 || app.is_archived === true" class="status-badge small status-ARCHIVED">
                      📁 已归档
                    </span>
                    <span *ngIf="app.is_archived !== 1 && app.is_archived !== true" class="text-muted">未归档</span>
                  </td>
                  <td>{{ app.verification_due_date | slice:0:10 }}</td>
                  <td>{{ app.created_by }}</td>
                  <td (click)="$event.stopPropagation()">
                    <a class="action-link" (click)="goToDetail(app.id)">详情</a>
                  </td>
                </tr>
                <tr *ngIf="applications.length === 0">
                  <td colspan="12" class="empty">暂无数据</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="sidebar">
          <div class="sidebar-section">
            <h3>证据摘要</h3>
            <div class="evidence-node">
              <div class="node-title">📋 借款申请</div>
              <div class="evidence-list">
                <div class="evidence-item">
                  <span class="evidence-name">身份证</span>
                  <span class="evidence-status required">必填</span>
                </div>
                <div class="evidence-item">
                  <span class="evidence-name">收入证明</span>
                  <span class="evidence-status required">必填</span>
                </div>
              </div>
            </div>
            <div class="evidence-node">
              <div class="node-title">🔍 资料核验</div>
              <div class="evidence-list">
                <div class="evidence-item">
                  <span class="evidence-name">征信报告</span>
                  <span class="evidence-status required">必填</span>
                </div>
                <div class="evidence-item">
                  <span class="evidence-name">核验记录</span>
                  <span class="evidence-status required">必填</span>
                </div>
              </div>
            </div>
            <div class="evidence-node">
              <div class="node-title">✅ 审批放款</div>
              <div class="evidence-list">
                <div class="evidence-item">
                  <span class="evidence-name">审批意见</span>
                  <span class="evidence-status required">必填</span>
                </div>
                <div class="evidence-item">
                  <span class="evidence-name">放款凭证</span>
                  <span class="evidence-status required">必填</span>
                </div>
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <h3>按状态统计</h3>
            <div class="status-stats">
              <div *ngFor="let st of statusList" class="status-stat-item">
                <span class="status-badge small" [ngClass]="'status-' + st.value">{{ st.label }}</span>
                <span class="status-count">{{ stats.byStatus?.[st.value] || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="showCreateModal" class="modal-overlay" (click)="showCreateModal = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>新建借款申请单</h3>
            <button class="close-btn" (click)="showCreateModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>申请人姓名 *</label>
              <input type="text" [(ngModel)]="newForm.applicant_name" placeholder="请输入姓名">
            </div>
            <div class="form-row">
              <label>身份证号 *</label>
              <input type="text" [(ngModel)]="newForm.id_card" placeholder="请输入身份证号">
            </div>
            <div class="form-row">
              <label>联系电话 *</label>
              <input type="text" [(ngModel)]="newForm.phone" placeholder="请输入联系电话">
            </div>
            <div class="form-row">
              <label>借款金额(元) *</label>
              <input type="number" [(ngModel)]="newForm.amount" placeholder="请输入金额">
            </div>
            <div class="form-row">
              <label>借款期限(月)</label>
              <input type="number" [(ngModel)]="newForm.term_months" value="12">
            </div>
            <div class="form-row">
              <label>借款用途</label>
              <input type="text" [(ngModel)]="newForm.purpose" placeholder="请输入用途">
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea [(ngModel)]="newForm.remark" rows="2"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="showCreateModal = false">取消</button>
            <button class="btn-primary" (click)="createApplication()">创建</button>
          </div>
        </div>
      </div>

      <div *ngIf="showBatchModal" class="modal-overlay" (click)="closeBatchModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>批量处理 ({{ selectedIds.length }} 笔)</h3>
            <button class="close-btn" (click)="closeBatchModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <label>处理方式</label>
              <select [(ngModel)]="batchAction">
                <option *ngIf="isRiskAuditor" value="PASS">批量核验通过</option>
                <option *ngIf="isRiskAuditor" value="FAIL">批量核验失败</option>
                <option *ngIf="isRiskAuditor" value="RETURN">批量退回补正</option>
                <option *ngIf="isSupervisor" value="APPROVE">批量审批通过</option>
                <option *ngIf="isSupervisor" value="REJECT">批量审批拒绝</option>
                <option *ngIf="isSupervisor" value="APPROVE_RETURN">批量退回补正</option>
                <option *ngIf="isSupervisor" value="ARCHIVE">📁 批量月底归档</option>
              </select>
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea [(ngModel)]="batchRemark" rows="3" placeholder="请输入处理备注（可选）"></textarea>
            </div>
            <p class="tip">
              ⚠️ 系统将逐条校验，异常单据会被拦截。处理完成后可查看批量结果。
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeBatchModal()">取消</button>
            <button class="btn-primary" (click)="doBatch()">确认批量处理</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .list-page { display: flex; flex-direction: column; gap: 16px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-header h2 { margin: 0; color: #1e3a5f; }

    .stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
    .stat-card {
      background: white; padding: 20px; border-radius: 8px;
      cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat-label { font-size: 13px; color: #666; margin-top: 4px; }
    .stat-card.normal .stat-value { color: #38a169; }
    .stat-card.approaching .stat-value { color: #dd6b20; }
    .stat-card.overdue .stat-value { color: #e53e3e; }
    .stat-card.total .stat-value { color: #2c5282; }
    .stat-card.archived .stat-value { color: #4a5568; }

    .filter-bar {
      background: white; padding: 12px 16px; border-radius: 8px;
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-group label { font-size: 13px; color: #555; }
    .filter-group select, .filter-group input {
      padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;
    }
    .filter-group.search { flex: 1; }
    .filter-group.search input { width: 100%; min-width: 200px; }
    .btn-link { background: none; border: none; color: #2c5282; cursor: pointer; font-size: 13px; }

    .content-layout { display: grid; grid-template-columns: 1fr 280px; gap: 16px; }
    .main-content { min-width: 0; }
    .sidebar { display: flex; flex-direction: column; gap: 16px; }

    .table-container {
      background: white; border-radius: 8px; overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      background: #f7fafc; padding: 12px; text-align: left;
      font-size: 13px; color: #4a5568; border-bottom: 1px solid #e2e8f0;
    }
    .data-table td {
      padding: 12px; border-bottom: 1px solid #edf2f7; font-size: 14px;
    }
    .data-table tbody tr { cursor: pointer; transition: background 0.15s; }
    .data-table tbody tr:hover { background: #f7fafc; }
    .data-table tbody tr.due-overdue { background: #fff5f5; }
    .data-table tbody tr.due-approaching { background: #fffaf0; }
    .data-table tbody tr.row-archived { background: #edf2f7; opacity: 0.85; }
    .data-table .mono { font-family: monospace; }
    .data-table .amount { text-align: right; font-weight: 500; }
    .data-table .empty { text-align: center; padding: 40px; color: #999; }
    .action-link { color: #2c5282; cursor: pointer; text-decoration: none; }
    .action-link:hover { text-decoration: underline; }

    .status-badge {
      display: inline-block; padding: 3px 10px; border-radius: 12px;
      font-size: 12px; font-weight: 500;
    }
    .status-badge.small { padding: 2px 8px; font-size: 11px; }
    .status-DRAFT { background: #edf2f7; color: #4a5568; }
    .status-PENDING_VERIFICATION { background: #bee3f8; color: #2b6cb0; }
    .status-VERIFICATION_PASSED { background: #c6f6d5; color: #276749; }
    .status-VERIFICATION_FAILED { background: #fed7d7; color: #c53030; }
    .status-CORRECTION_REQUIRED { background: #feebc8; color: #c05621; }
    .status-APPROVED { background: #c6f6d5; color: #276749; }
    .status-REJECTED { background: #fed7d7; color: #c53030; }
    .status-COMPLETED { background: #e9d8fd; color: #553c9a; }
    .status-ARCHIVED { background: #4a5568 !important; color: #fff !important; }

    .due-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .due-normal { background: #c6f6d5; color: #276749; }
    .due-approaching { background: #feebc8; color: #c05621; }
    .due-overdue { background: #fed7d7; color: #c53030; }

    .sidebar-section {
      background: white; padding: 16px; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .sidebar-section h3 { margin: 0 0 12px 0; font-size: 14px; color: #1e3a5f; }
    .evidence-node { margin-bottom: 12px; }
    .evidence-node:last-child { margin-bottom: 0; }
    .node-title { font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 6px; }
    .evidence-list { display: flex; flex-direction: column; gap: 4px; }
    .evidence-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 4px 0; font-size: 12px;
    }
    .evidence-name { color: #4a5568; }
    .evidence-status.required {
      background: #fed7d7; color: #c53030; padding: 1px 6px;
      border-radius: 3px; font-size: 10px;
    }
    .evidence-status.optional {
      background: #e2e8f0; color: #718096; padding: 1px 6px;
      border-radius: 3px; font-size: 10px;
    }

    .status-stats { display: flex; flex-direction: column; gap: 6px; }
    .status-stat-item {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 12px;
    }
    .status-count { color: #718096; font-weight: 500; }

    .btn-primary {
      padding: 8px 16px; background: #2c5282; color: white;
      border: none; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
    .btn-primary:hover { background: #1e3a5f; }
    .btn-secondary {
      padding: 8px 16px; background: white; color: #2c5282;
      border: 1px solid #2c5282; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
    .btn-secondary:hover { background: #f0f7ff; }

    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: white; border-radius: 8px; width: 480px; max-width: 90vw;
      max-height: 85vh; display: flex; flex-direction: column;
    }
    .modal-header {
      padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-header h3 { margin: 0; font-size: 16px; color: #1e3a5f; }
    .close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #718096; }
    .modal-body { padding: 20px; overflow-y: auto; }
    .modal-footer {
      padding: 12px 20px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: flex-end; gap: 8px;
    }
    .form-row { margin-bottom: 14px; }
    .form-row label { display: block; font-size: 13px; color: #4a5568; margin-bottom: 5px; }
    .form-row input, .form-row select, .form-row textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0;
      border-radius: 4px; font-size: 13px; box-sizing: border-box;
    }
    .form-row textarea { resize: vertical; }
    .tip { font-size: 12px; color: #dd6b20; background: #fffaf0; padding: 8px; border-radius: 4px; }
    .text-muted { color: #a0aec0; font-size: 12px; }
  `]
})
export class ApplicationListComponent implements OnInit {
  applications: LoanApplication[] = [];
  stats: Stats = { byStatus: {}, byDue: { normal: 0, approaching: 0, overdue: 0 }, total: 0, archived: 0 };
  selectedIds: number[] = [];

  filterStatus = '';
  filterNode = '';
  filterDue = '';
  filterArchived = '';
  keyword = '';

  showCreateModal = false;
  showBatchModal = false;
  batchAction = 'PASS';
  batchRemark = '';

  newForm: any = {
    applicant_name: '',
    id_card: '',
    phone: '',
    amount: null,
    term_months: 12,
    purpose: '',
    remark: ''
  };

  statusList = [
    { value: 'DRAFT', label: '草稿' },
    { value: 'PENDING_VERIFICATION', label: '待核验' },
    { value: 'VERIFICATION_PASSED', label: '核验完成' },
    { value: 'VERIFICATION_FAILED', label: '核验失败' },
    { value: 'CORRECTION_REQUIRED', label: '退回补正' },
    { value: 'APPROVED', label: '审批通过' },
    { value: 'REJECTED', label: '已拒绝' },
    { value: 'COMPLETED', label: '已完成' }
  ];

  constructor(
    private loanService: LoanService,
    private auth: AuthService,
    private router: Router
  ) {}

  get currentUser(): User | null { return this.auth.currentUser; }
  get isCreditOfficer(): boolean { return this.currentUser?.role === 'CREDIT_OFFICER'; }
  get isRiskAuditor(): boolean { return this.currentUser?.role === 'RISK_AUDITOR'; }
  get isSupervisor(): boolean { return this.currentUser?.role === 'LOAN_SUPERVISOR'; }

  get canBatch(): boolean {
    if (this.isRiskAuditor) return true;
    if (this.isSupervisor) return true;
    return false;
  }

  get isAllSelected(): boolean {
    return this.applications.length > 0 && this.selectedIds.length === this.applications.length;
  }

  ngOnInit(): void {
    this.loadApplications();
    this.loadStats();
  }

  loadApplications(): void {
    const params: any = {};
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.filterNode) params.node = this.filterNode;
    if (this.filterDue) params.due_status = this.filterDue;
    if (this.filterArchived) params.is_archived = this.filterArchived;
    if (this.keyword) params.keyword = this.keyword;

    this.loanService.getApplications(params).subscribe({
      next: (data) => {
        this.applications = data;
        this.selectedIds = [];
      },
      error: () => {}
    });
  }

  loadStats(): void {
    this.loanService.getStats().subscribe({
      next: (data) => { this.stats = data; },
      error: () => {}
    });
  }

  filterByDue(status: string): void {
    this.filterDue = status;
    this.filterArchived = '';
    this.loadApplications();
  }

  filterByArchived(archived: string): void {
    this.filterDue = '';
    this.filterArchived = archived;
    this.loadApplications();
  }

  clearDueFilter(): void {
    this.filterDue = '';
    this.filterArchived = '';
    this.loadApplications();
  }

  clearFilters(): void {
    this.filterStatus = '';
    this.filterNode = '';
    this.filterDue = '';
    this.filterArchived = '';
    this.keyword = '';
    this.loadApplications();
  }

  onSearch(): void {
    this.loadApplications();
  }

  dueLabel(status: string): string {
    const map: { [key: string]: string } = { normal: '正常', approaching: '临期', overdue: '逾期' };
    return map[status] || status;
  }

  toggleSelect(id: number): void {
    const idx = this.selectedIds.indexOf(id);
    if (idx >= 0) {
      this.selectedIds.splice(idx, 1);
    } else {
      this.selectedIds.push(id);
    }
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.selectedIds = [];
    } else {
      this.selectedIds = this.applications.map(a => a.id);
    }
  }

  goToDetail(id: number): void {
    this.router.navigate(['/application', id]);
  }

  createApplication(): void {
    this.loanService.createApplication(this.newForm).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.newForm = {
          applicant_name: '', id_card: '', phone: '',
          amount: null, term_months: 12, purpose: '', remark: ''
        };
        this.loadApplications();
        this.loadStats();
      },
      error: (err) => {
        alert(err.error?.error || '创建失败');
      }
    });
  }

  closeBatchModal(): void {
    this.showBatchModal = false;
  }

  doBatch(): void {
    const action = this.batchAction;
    const ids = [...this.selectedIds];
    const remark = this.batchRemark;

    let request$;
    if (action === 'ARCHIVE') {
      request$ = this.loanService.batchArchive(ids, remark);
    } else if (this.isRiskAuditor) {
      request$ = this.loanService.batchVerify(ids, action, remark);
    } else {
      const approveAction = action === 'APPROVE_RETURN' ? 'RETURN' : action;
      request$ = this.loanService.batchApprove(ids, approveAction, remark);
    }

    request$.subscribe({
      next: (result) => {
        sessionStorage.setItem('batchResult', JSON.stringify(result));
        this.showBatchModal = false;
        this.selectedIds = [];
        this.router.navigate(['/batch-result']);
      },
      error: (err) => {
        alert(err.error?.error || '批量处理失败');
      }
    });
  }

  protected readonly NODE_NAMES = NODE_NAMES;
}
