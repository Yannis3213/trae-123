import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChip, MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { TopicService, AuthService } from '../services/api.service';
import {
  Topic,
  TopicListResponse,
  TOPIC_STATUS_LABEL,
  TOPIC_STATUS_COLOR,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  WARNING_LABEL,
  ApiError,
} from '../models';

const SORT_COLUMN_MAP: Record<string, string> = {
  id: 'updated_at',
  title: 'title',
  category: 'category',
  priority: 'priority',
  status: 'status',
  warning: 'submission_deadline',
  handler: 'current_handler_name',
  deadline: 'submission_deadline',
  version: 'version',
};

const STATUSES: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending_dispatch', label: '待派发' },
  { value: 'processing', label: '处理中' },
  { value: 'returned', label: '退回补正' },
  { value: 'closed', label: '已关闭' },
  { value: 'archived', label: '已归档' },
];

const WARNINGS: { value: string; label: string }[] = [
  { value: '', label: '全部预警' },
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '临期' },
  { value: 'overdue', label: '逾期' },
];

@Component({
  selector: 'app-topic-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatChipsModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSortModule,
  ],
  template: `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h2 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:4px;">📋 选题单列表</h2>
          <div style="font-size:13px;color:#6b7280;">选题申报 → 采访安排 → 稿件提交，全流程闭环追踪</div>
        </div>
        <div style="display:flex;gap:10px;">
          <button
            mat-raised-button
            color="accent"
            [disabled]="selection.isEmpty()"
            (click)="goBatch()"
          >
            <mat-icon style="margin-right:6px;">playlist_add_check</mat-icon>
            批量处理（{{ selection.selected.length }}）
          </button>
          <button
            *ngIf="user?.role === 'registrar'"
            mat-raised-button
            color="primary"
            routerLink="/topics/new"
          >
            <mat-icon style="margin-right:6px;">add</mat-icon>
            新建选题申报
          </button>
        </div>
      </div>

      <mat-card style="padding:20px 20px 8px;margin-bottom:20px;">
        <form [formGroup]="filterForm" (ngSubmit)="loadPage(1)">
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;align-items:end;">
            <mat-form-field appearance="outline" style="margin:0;">
              <mat-label>关键词搜索</mat-label>
              <input matInput formControlName="keyword" placeholder="标题/描述搜索" />
              <mat-icon matSuffix style="color:#9ca3af;">search</mat-icon>
            </mat-form-field>
            <mat-form-field appearance="outline" style="margin:0;">
              <mat-label>状态</mat-label>
              <mat-select formControlName="status">
                <mat-option *ngFor="let s of STATUSES" [value]="s.value">{{ s.label }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" style="margin:0;">
              <mat-label>分类</mat-label>
              <mat-select formControlName="category">
                <mat-option value="">全部分类</mat-option>
                <mat-option *ngFor="let c of CATEGORY_OPTIONS" [value]="c">{{ c }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" style="margin:0;">
              <mat-label>优先级</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="">全部优先级</mat-option>
                <mat-option *ngFor="let p of PRIORITY_OPTIONS" [value]="p.value">{{ p.label }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" style="margin:0;">
              <mat-label>到期预警</mat-label>
              <mat-select formControlName="warning">
                <mat-option *ngFor="let w of WARNINGS" [value]="w.value">{{ w.label }}</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div style="display:flex;gap:10px;margin:12px 0 16px;justify-content:flex-end;">
            <button mat-stroked-button type="button" (click)="resetFilter()">
              <mat-icon style="margin-right:4px;">refresh</mat-icon>重置
            </button>
            <button mat-raised-button color="primary" type="submit">
              <mat-icon style="margin-right:4px;">filter_alt</mat-icon>筛选
            </button>
          </div>
        </form>
      </mat-card>

      <mat-card style="padding:4px 12px;">
        <table mat-table [dataSource]="dataSource" matSort>
          <ng-container matColumnDef="select">
            <th mat-header-cell *matHeaderCellDef style="width:52px;">
              <mat-checkbox
                (change)="$event ? masterToggle() : null"
                [checked]="selection.hasValue() && isAllSelected()"
                [indeterminate]="selection.hasValue() && !isAllSelected()"
              ></mat-checkbox>
            </th>
            <td mat-cell *matCellDef="let row">
              <mat-checkbox
                (click)="$event.stopPropagation()"
                (change)="$event ? selection.toggle(row) : null"
                [checked]="selection.isSelected(row)"
              ></mat-checkbox>
            </td>
          </ng-container>
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:80px;">编号</th>
            <td mat-cell *matCellDef="let row">
              <span style="font-family:monospace;font-size:11px;color:#6b7280;">{{ shortId(row.id) }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="min-width:260px;">选题名称</th>
            <td mat-cell *matCellDef="let row" style="cursor:pointer;" (click)="goDetail(row.id)">
              <div style="font-weight:600;color:#1f2937;margin-bottom:3px;">{{ row.title }}</div>
              <div style="font-size:12px;color:#6b7280;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{{ row.description }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:100px;">分类</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip style="background:#e0e7ff;color:#4338ca;font-size:11px;padding:0 8px;">{{ row.category }}</mat-chip>
            </td>
          </ng-container>
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:80px;">优先级</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip [style.background]="priorityBg(row.priority)" [style.color]="priorityColor(row.priority)" style="font-size:11px;padding:0 8px;">
                {{ priorityLabel(row.priority) }}
              </mat-chip>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:100px;">状态</th>
            <td mat-cell *matCellDef="let row">
              <span
                style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;color:white;"
                [style.background]="TOPIC_STATUS_COLOR[row.status]"
                matTooltip="状态：{{ TOPIC_STATUS_LABEL[row.status] }}"
              >
                {{ TOPIC_STATUS_LABEL[row.status] }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="warning">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:90px;">预警</th>
            <td mat-cell *matCellDef="let row">
              <span
                *ngIf="row.warning_level"
                matTooltip="{{ row.is_overdue ? (row.submission_deadline || row.interview_deadline) + '已到期' : (row.warning_level === 'warning' ? '临近截止日期' : '状态正常') }}"
                style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:2px 8px;border-radius:12px;font-weight:600;"
                [style.color]="WARNING_LABEL[row.warning_level].color"
                [style.background]="WARNING_LABEL[row.warning_level].color + '15'"
              >
                <span *ngIf="row.warning_level === 'overdue'" style="font-size:13px;">🔴</span>
                <span *ngIf="row.warning_level === 'warning'" style="font-size:13px;">🟡</span>
                <span *ngIf="row.warning_level === 'normal'" style="font-size:13px;">🟢</span>
                {{ WARNING_LABEL[row.warning_level].label }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="handler">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:130px;">当前处理人</th>
            <td mat-cell *matCellDef="let row">
              <div style="font-size:12.5px;color:#1f2937;">{{ row.current_handler_name || '—' }}</div>
              <div *ngIf="row.is_overdue && row.current_handler_name" style="font-size:11px;color:#dc2626;font-weight:600;">⚠ 责任人节点超时</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="deadline">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:160px;">截止时间</th>
            <td mat-cell *matCellDef="let row">
              <div style="font-size:12px;color:#374151;">
                <span *ngIf="row.submission_deadline">稿件：{{ formatDate(row.submission_deadline) }}</span>
                <span *ngIf="!row.submission_deadline && row.interview_deadline">采访：{{ formatDate(row.interview_deadline) }}</span>
                <span *ngIf="!row.submission_deadline && !row.interview_deadline">—</span>
              </div>
              <div *ngIf="row.interview_deadline && row.submission_deadline" style="font-size:11px;color:#9ca3af;margin-top:2px;">
                采访：{{ formatDate(row.interview_deadline) }}
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="version">
            <th mat-header-cell *matHeaderCellDef mat-sort-header style="width:70px;">版本</th>
            <td mat-cell *matCellDef="let row">
              <span style="font-family:monospace;font-size:12px;color:#6b7280;">v{{ row.version }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef style="width:110px;text-align:right;">操作</th>
            <td mat-cell *matCellDef="let row" style="text-align:right;">
              <button
                mat-icon-button
                color="primary"
                (click)="goDetail(row.id)"
                matTooltip="查看详情并办理"
              >
                <mat-icon>visibility</mat-icon>
              </button>
              <button
                mat-icon-button
                (click)="selection.toggle(row)"
                matTooltip="选中批量处理"
              >
                <mat-icon [color]="selection.isSelected(row) ? 'accent' : ''">{{ selection.isSelected(row) ? 'check_circle' : 'add_circle_outline' }}</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns; sticky: true;"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;" (click)="goDetail(row.id)" style="cursor:pointer;"></tr>
        </table>
        <div *ngIf="loading && dataSource.data.length === 0" style="padding:60px;text-align:center;color:#9ca3af;">
          <mat-spinner diameter="32" style="margin:0 auto 12px;"></mat-spinner>
          正在加载选题单列表...
        </div>
        <div *ngIf="!loading && dataSource.data.length === 0" style="padding:60px;text-align:center;color:#9ca3af;">
          <div style="font-size:48px;margin-bottom:8px;">📭</div>
          暂无符合条件的选题单
        </div>
        <mat-paginator
          #paginator
          [length]="total"
          [pageSize]="pageSize"
          [pageIndex]="page - 1"
          [pageSizeOptions]="[10, 20, 50, 100]"
          showFirstLastButtons
          (page)="onPage($event)"
          style="margin-top:8px;"
        ></mat-paginator>
      </mat-card>
    </div>
  `,
})
export class TopicListPageComponent implements OnInit, AfterViewInit {
  columns = ['select', 'id', 'title', 'category', 'priority', 'status', 'warning', 'handler', 'deadline', 'version', 'action'];
  STATUSES = STATUSES;
  WARNINGS = WARNINGS;
  CATEGORY_OPTIONS = CATEGORY_OPTIONS;
  PRIORITY_OPTIONS = PRIORITY_OPTIONS;
  TOPIC_STATUS_LABEL = TOPIC_STATUS_LABEL;
  TOPIC_STATUS_COLOR = TOPIC_STATUS_COLOR;
  WARNING_LABEL = WARNING_LABEL;

  filterForm: FormGroup;
  dataSource = new MatTableDataSource<Topic>([]);
  total = 0;
  page = 1;
  pageSize = 20;
  loading = false;
  user = this.auth.currentUser;
  selection = new SelectionModel<Topic>(true, []);
  sortBy = 'updated_at';
  sortDir = 'desc';

  @ViewChild('paginator', { static: false }) paginator!: MatPaginator;
  @ViewChild(MatSort, { static: false }) sort!: MatSort;

  constructor(
    private fb: FormBuilder,
    private topicService: TopicService,
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar
  ) {
    this.filterForm = this.fb.group({
      keyword: [''],
      status: [''],
      category: [''],
      priority: [''],
      warning: [''],
    });
  }

  ngOnInit() {
    this.loadPage(1);
    this.auth.user$.subscribe(() => {
      this.selection.clear();
      this.loadPage(1);
    });
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.sort.sortChange.subscribe((s: Sort) => {
      this.sortBy = SORT_COLUMN_MAP[s.active] || 'updated_at';
      this.sortDir = s.direction || 'desc';
      this.loadPage(1);
    });
  }

  shortId(id: string): string {
    return id.slice(0, 6).toUpperCase();
  }

  priorityLabel(v: string): string {
    return PRIORITY_OPTIONS.find((p) => p.value === v)?.label || v;
  }
  priorityBg(v: string): string {
    return v === 'high' ? '#fee2e2' : v === 'medium' ? '#fef3c7' : '#dcfce7';
  }
  priorityColor(v: string): string {
    return v === 'high' ? '#dc2626' : v === 'medium' ? '#92400e' : '#166534';
  }

  formatDate(s: string | null | undefined): string {
    if (!s) return '';
    try {
      const d = new Date(s);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return s;
    }
  }

  onPage(e: PageEvent) {
    this.pageSize = e.pageSize;
    this.loadPage(e.pageIndex + 1);
  }

  resetFilter() {
    this.filterForm.reset({ keyword: '', status: '', category: '', priority: '', warning: '' });
    this.loadPage(1);
  }

  loadPage(p: number) {
    this.page = p;
    this.loading = true;
    this.selection.clear();
    const v = this.filterForm.value;
    this.topicService
      .list({
        status: v.status,
        category: v.category,
        priority: v.priority,
        keyword: v.keyword,
        warning: v.warning,
        page: p,
        page_size: this.pageSize,
        sort_by: this.sortBy,
        sort_dir: this.sortDir,
      })
      .subscribe({
        next: (r: TopicListResponse) => {
          this.dataSource.data = r.items;
          this.total = r.total;
          this.loading = false;
        },
        error: (e: ApiError) => {
          this.loading = false;
          this.snack.open(`加载失败：${e.message}`, '重试', { duration: 5000 }).onAction().subscribe(() => this.loadPage(p));
        },
      });
  }

  isAllSelected(): boolean {
    const n = this.dataSource.data.length;
    return n > 0 && this.selection.selected.length === n;
  }
  masterToggle() {
    this.isAllSelected() ? this.selection.clear() : this.dataSource.data.forEach((r) => this.selection.select(r));
  }

  goDetail(id: string) {
    this.router.navigate(['/topics', id]);
  }
  goBatch() {
    if (this.selection.isEmpty()) {
      this.snack.open('请先勾选要批量处理的选题单', '知道了', { duration: 3000 });
      return;
    }
    const ids = this.selection.selected.map((s) => s.id).join(',');
    const versions = this.selection.selected.map((s) => `${s.id}:${s.version}`).join(',');
    this.router.navigate(['/topics/batch'], { queryParams: { ids, versions } });
  }
}
