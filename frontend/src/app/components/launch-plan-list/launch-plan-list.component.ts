import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LaunchPlanService } from '../../services/launch-plan.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { LaunchPlan, Stats, BatchResult } from '../../models/launch-plan';

@Component({
  selector: 'app-launch-plan-list',
  template: `
    <div class="list-page">
      <div class="stats-bar flex gap-md mb-md wrap">
        <div class="stat-card" (click)="quickFilter('all')" [class.active]="activeFilter === 'all'">
          <div class="label">全部计划单</div>
          <div class="value" style="color: #2563eb">{{ stats?.total || 0 }}</div>
        </div>
        <div class="stat-card" (click)="quickFilter('draft')" [class.active]="activeFilter === 'draft'">
          <div class="label">草稿</div>
          <div class="value" style="color: #64748b">{{ stats?.draft || 0 }}</div>
        </div>
        <div class="stat-card" (click)="quickFilter('pending_review')" [class.active]="activeFilter === 'pending_review'">
          <div class="label">待复核</div>
          <div class="value" style="color: #d97706">{{ stats?.pending_review || 0 }}</div>
        </div>
        <div class="stat-card" (click)="quickFilter('archived')" [class.active]="activeFilter === 'archived'">
          <div class="label">已归档</div>
          <div class="value" style="color: #059669">{{ stats?.archived || 0 }}</div>
        </div>
        <div class="stat-card" (click)="quickFilterWarning('overdue')" [class.active-warning]="activeWarning === 'overdue'">
          <div class="label">⚠️ 已逾期</div>
          <div class="value" style="color: #dc2626">{{ stats?.overdue || 0 }}</div>
        </div>
        <div class="stat-card" (click)="quickFilterWarning('urgent')" [class.active-warning]="activeWarning === 'urgent'">
          <div class="label">⏰ 临期</div>
          <div class="value" style="color: #ea580c">{{ stats?.urgent || 0 }}</div>
        </div>
      </div>

      <div class="filter-bar card mb-md">
        <div class="flex flex-between wrap gap-md">
          <div class="flex gap-md wrap">
            <div class="form-item" style="margin:0; min-width:220px">
              <label class="form-label">状态</label>
              <select class="select" [(ngModel)]="filters.status" (change)="loadList()">
                <option value="">全部状态</option>
                <option value="draft">草稿</option>
                <option value="pending_review">待复核</option>
                <option value="archived">已归档</option>
              </select>
            </div>
            <div class="form-item" style="margin:0; min-width:180px">
              <label class="form-label">优先级</label>
              <select class="select" [(ngModel)]="filters.priority" (change)="loadList()">
                <option value="">全部优先级</option>
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div class="form-item" style="margin:0; min-width:180px">
              <label class="form-label">责任人</label>
              <select class="select" [(ngModel)]="filters.owner" (change)="loadList()">
                <option value="">全部责任人</option>
                <option *ngFor="let u of allUsers" [value]="u.name">{{u.name}}（{{u.role_name}}）</option>
              </select>
            </div>
            <div class="form-item" style="margin:0; min-width:180px">
              <label class="form-label">到期预警</label>
              <select class="select" [(ngModel)]="filters.warning" (change)="loadList()">
                <option value="">全部</option>
                <option value="normal">正常</option>
                <option value="urgent">临期（≤2天）</option>
                <option value="overdue">已逾期</option>
              </select>
            </div>
            <div class="form-item" style="margin:0; min-width:260px">
              <label class="form-label">关键词搜索</label>
              <input class="input" placeholder="客户名称 / 项目 / 计划单号"
                [(ngModel)]="filters.keyword" (keyup.enter)="loadList()">
            </div>
          </div>
          <div class="flex gap-sm align-end">
            <button class="btn" (click)="resetFilters()">🔄 重置</button>
            <button class="btn btn-primary" (click)="loadList()">🔍 查询</button>
            <button *ngIf="canCreate" class="btn btn-success" (click)="showCreateModal = true">➕ 新建计划单</button>
          </div>
        </div>
      </div>

      <div class="table-card card">
        <div class="flex flex-between mb-md">
          <div class="section-title" style="margin:0">上线计划单列表（共 {{total}} 条）</div>
          <div class="flex gap-sm" *ngIf="selectedIds.length > 0">
            <span style="color:var(--text-secondary);align-self:center">已选 {{selectedIds.length}} 条</span>
            <button *ngIf="canBatchSubmit" class="btn btn-warning btn-sm" (click)="batchAdvance('pending_review')">
              📤 批量推进到待复核
            </button>
            <button *ngIf="canBatchArchive" class="btn btn-success btn-sm" (click)="batchAdvance('archived')">
              ✅ 批量归档
            </button>
            <button class="btn btn-sm" (click)="clearSelection()">取消选择</button>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px">
                <input type="checkbox"
                  [checked]="isAllSelected"
                  (change)="toggleSelectAll()"
                  [disabled]="!selectableIds.length">
              </th>
              <th>计划单号</th>
              <th>客户名称</th>
              <th>项目名称</th>
              <th>优先级</th>
              <th>截止日期</th>
              <th>到期预警</th>
              <th>状态</th>
              <th>责任人</th>
              <th>当前处理人</th>
              <th>异常标签</th>
              <th style="width:140px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let plan of plans; trackBy: trackById">
              <td>
                <input type="checkbox"
                  [checked]="selectedIds.includes(plan.id)"
                  [disabled]="!selectableIds.includes(plan.id)"
                  (change)="toggleSelect(plan.id)">
              </td>
              <td><a (click)="goDetail(plan)" style="cursor:pointer;font-weight:600">{{plan.plan_no}}</a></td>
              <td>{{plan.customer_name}}</td>
              <td>{{plan.project_name}}</td>
              <td>
                <span class="tag" [ngClass]="priorityTagClass(plan.priority)">{{plan.priority_name}}</span>
              </td>
              <td>{{plan.deadline}}</td>
              <td>
                <span *ngIf="plan.deadline_warning === 'normal'" class="tag tag-success">正常</span>
                <span *ngIf="plan.deadline_warning === 'urgent'" class="tag tag-warning">临期</span>
                <span *ngIf="plan.deadline_warning === 'overdue'" class="tag tag-urgent">已逾期</span>
              </td>
              <td>
                <span class="tag" [ngClass]="statusTagClass(plan.status)">{{plan.status_name}}</span>
              </td>
              <td>{{plan.owner}}</td>
              <td>
                <span *ngIf="plan.current_handler === currentUser.name" style="color:#2563eb;font-weight:600">
                  👉 {{plan.current_handler}}
                </span>
                <span *ngIf="plan.current_handler !== currentUser.name">{{plan.current_handler}}</span>
              </td>
              <td>
                <span *ngFor="let tag of planAbnormalTags(plan)" class="tag tag-danger" style="margin-right:4px;margin-bottom:2px">
                  {{tag}}
                </span>
                <span *ngIf="planAbnormalTags(plan).length === 0" style="color:var(--text-secondary)">无</span>
              </td>
              <td>
                <button class="btn btn-sm" (click)="goDetail(plan)">📄 详情</button>
              </td>
            </tr>
            <tr *ngIf="plans.length === 0">
              <td colspan="12" style="text-align:center;padding:40px;color:var(--text-secondary)">
                暂无数据，点击「新建计划单」创建第一张上线计划单
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <app-create-plan-modal
      *ngIf="showCreateModal"
      (close)="showCreateModal = false; $event ? loadList() : null"
    ></app-create-plan-modal>

    <app-batch-result-modal
      *ngIf="batchResult"
      [result]="batchResult"
      (close)="batchResult = null; loadList()"
    ></app-batch-result-modal>
  `,
  styles: [`
    .stats-bar .stat-card { cursor: pointer; transition: all .2s; }
    .stats-bar .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,.08); }
    .stats-bar .stat-card.active { box-shadow: 0 0 0 2px #2563eb inset; }
    .stats-bar .stat-card.active-warning { box-shadow: 0 0 0 2px #dc2626 inset; }
    .data-table th, .data-table td {
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .data-table th {
      background: var(--bg-light);
      color: var(--text-regular);
      font-weight: 600;
      position: sticky;
      top: 0;
    }
    .data-table tr:hover td { background: #fafbfc; }
    .align-end { align-items: flex-end; }
  `],
})
export class LaunchPlanListComponent implements OnInit, OnDestroy {
  plans: LaunchPlan[] = [];
  stats: Stats | null = null;
  total = 0;
  selectedIds: string[] = [];
  activeFilter = 'all';
  activeWarning = '';
  showCreateModal = false;
  batchResult: BatchResult | null = null;

  filters = {
    status: '',
    priority: '',
    owner: '',
    warning: '',
    keyword: '',
  };

  private subs = new Subscription();

  constructor(
    private svc: LaunchPlanService,
    public auth: AuthService,
    private router: Router,
    private toast: ToastService,
  ) {}

  get currentUser() { return this.auth.currentUser; }
  get allUsers() { return this.auth.getAllUsers(); }

  get canCreate() {
    return ['cs_manager', 'delivery_consultant'].includes(this.currentUser.role);
  }

  get canBatchSubmit() {
    return ['cs_manager', 'delivery_consultant', 'cs_lead'].includes(this.currentUser.role);
  }

  get canBatchArchive() {
    return this.currentUser.role === 'cs_lead';
  }

  get selectableIds(): string[] {
    return this.plans.filter(p => {
      if (p.status === 'archived') return false;
      if (p.deadline_warning === 'overdue') return false;
      return true;
    }).map(p => p.id);
  }

  get isAllSelected(): boolean {
    if (this.selectableIds.length === 0) return false;
    return this.selectableIds.every(id => this.selectedIds.includes(id));
  }

  ngOnInit() {
    this.loadAll();
    this.subs.add(this.auth.user$.subscribe(() => {
      this.selectedIds = [];
      this.loadAll();
    }));
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  loadAll() {
    this.loadStats();
    this.loadList();
  }

  loadStats() {
    this.svc.getStats().subscribe(
      (s) => (this.stats = s),
      (e) => this.toast.error('统计加载失败：' + (e.error?.error || e.message))
    );
  }

  loadList() {
    const q: any = {};
    if (this.filters.status) q.status = this.filters.status;
    if (this.filters.priority) q.priority = this.filters.priority;
    if (this.filters.owner) q.owner = this.filters.owner;
    if (this.filters.warning) q.warning = this.filters.warning;
    if (this.filters.keyword) q.keyword = this.filters.keyword;
    this.svc.getList(q).subscribe(
      (res) => {
        this.plans = res.items;
        this.total = res.total;
        this.selectedIds = this.selectedIds.filter(id =>
          this.plans.some(p => p.id === id));
      },
      (e) => this.toast.error('列表加载失败：' + (e.error?.error || e.message))
    );
  }

  quickFilter(status: string) {
    this.activeFilter = status;
    this.activeWarning = '';
    this.filters.warning = '';
    this.filters.status = status === 'all' ? '' : status;
    this.loadList();
  }

  quickFilterWarning(warning: string) {
    this.activeWarning = this.activeWarning === warning ? '' : warning;
    this.filters.warning = this.activeWarning;
    this.activeFilter = 'all';
    this.filters.status = '';
    this.loadList();
  }

  resetFilters() {
    this.filters = { status: '', priority: '', owner: '', warning: '', keyword: '' };
    this.activeFilter = 'all';
    this.activeWarning = '';
    this.loadList();
  }

  goDetail(p: LaunchPlan) {
    this.router.navigate(['/launch-plans', p.id]);
  }

  toggleSelect(id: string) {
    const idx = this.selectedIds.indexOf(id);
    if (idx >= 0) this.selectedIds.splice(idx, 1);
    else this.selectedIds.push(id);
  }

  toggleSelectAll() {
    if (this.isAllSelected) {
      this.selectedIds = [];
    } else {
      this.selectedIds = [...this.selectableIds];
    }
  }

  clearSelection() { this.selectedIds = []; }

  trackById(_: number, p: LaunchPlan) { return p.id; }

  priorityTagClass(p: string) {
    switch (p) {
      case 'urgent': return 'tag-urgent';
      case 'high': return 'tag-warning';
      case 'medium': return 'tag-primary';
      case 'low': return 'tag-info';
      default: return 'tag-info';
    }
  }

  statusTagClass(s: string) {
    switch (s) {
      case 'draft': return 'tag-info';
      case 'pending_review': return 'tag-warning';
      case 'archived': return 'tag-success';
      default: return 'tag-info';
    }
  }

  planAbnormalTags(p: LaunchPlan): string[] {
    const tags: string[] = [];
    if (p.deadline_warning === 'overdue') tags.push('已逾期');
    if (p.reject_reason) tags.push('被退回');
    if (!p.launch_target || p.launch_target.length < 10) tags.push('缺上线目标');
    if (!p.config_checklist || p.config_checklist.length < 10) tags.push('缺配置检查');
    if (p.status === 'pending_review' && (!p.acceptance_notes || p.acceptance_notes.length < 10)) tags.push('待验收');
    return tags;
  }

  batchAdvance(target_status: string) {
    if (this.selectedIds.length === 0) return;
    const targetLabel = target_status === 'archived' ? '批量归档' : '批量推进到待复核';
    if (!confirm(`确认${targetLabel}？共选中 ${this.selectedIds.length} 条计划单，逾期单据将被自动拦截并记录。`)) {
      return;
    }
    this.svc.batchAdvance(this.selectedIds, target_status).subscribe(
      (res) => {
        this.batchResult = res;
        this.selectedIds = [];
        this.loadStats();
      },
      (e) => this.toast.error(`${targetLabel}失败：` + (e.error?.error || e.message))
    );
  }
}
