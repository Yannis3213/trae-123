import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import {
  CheckinRecord,
  RecordStatus,
  UserRole,
  ProcessAction,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
  ACTION_LABELS,
  WARNING_COLORS,
  WARNING_LABELS,
  WarningType,
  BatchProcessResult,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_COLORS,
} from '../../models/models';

@Component({
  selector: 'app-warning-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warning-queue.component.html',
  styleUrl: './warning-queue.component.css',
})
export class WarningQueueComponent implements OnInit {
  records: (CheckinRecord & { warning_type: WarningType })[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  activeTab: string = '';

  selectedIds = new Set<number>();
  batchAction: ProcessAction = 'submit';
  batchComment = '';
  batchResults: BatchProcessResult[] | null = null;
  batchSuccessCount = 0;
  batchFailCount = 0;
  showBatchDialog = false;
  showBatchResultDialog = false;

  activeNav = 'warnings';

  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;
  ROLE_LABELS = ROLE_LABELS;
  ACTION_LABELS = ACTION_LABELS;
  WARNING_COLORS = WARNING_COLORS;
  WARNING_LABELS = WARNING_LABELS;
  BLOCK_TYPE_LABELS = BLOCK_TYPE_LABELS;
  BLOCK_TYPE_COLORS = BLOCK_TYPE_COLORS;

  batchActionOptions: { value: ProcessAction; label: string }[] = [
    { value: 'submit', label: '提交审核' },
    { value: 'approve', label: '审核通过' },
    { value: 'return', label: '退回补正' },
    { value: 'confirm_sync', label: '确认同步' },
    { value: 'correct', label: '补正提交' },
  ];

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadWarnings();
  }

  loadWarnings(): void {
    this.api.getWarnings(this.activeTab || undefined, this.page, this.pageSize).subscribe({
      next: (res) => {
        this.records = res.data || [];
        this.total = res.total;
      },
      error: (err) => console.error('加载预警列表失败', err),
    });
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    this.page = 1;
    this.loadWarnings();
  }

  switchNav(nav: string): void {
    this.activeNav = nav;
    if (nav === 'records') this.router.navigate(['/records']);
    else if (nav === 'statistics') this.router.navigate(['/statistics']);
  }

  getStatusLabel(status: RecordStatus): string {
    return STATUS_LABELS[status] || status;
  }

  getStatusColor(status: RecordStatus): string {
    return STATUS_COLORS[status] || '#95a5a6';
  }

  getRoleLabel(role: UserRole): string {
    return ROLE_LABELS[role] || role;
  }

  getDeadlineColor(deadline: string): string {
    const dl = new Date(deadline).getTime();
    const now = Date.now();
    const hours72 = 72 * 60 * 60 * 1000;
    const hours24 = 24 * 60 * 60 * 1000;
    if (dl - now <= hours24) return WARNING_COLORS.overdue;
    if (dl - now <= hours72) return WARNING_COLORS.approaching;
    return WARNING_COLORS.normal;
  }

  getWarningColor(warningType: string): string {
    return WARNING_COLORS[warningType as WarningType] || '#95a5a6';
  }

  getWarningLabel(warningType: string): string {
    return WARNING_LABELS[warningType as WarningType] || warningType;
  }

  navigateToDetail(id: number): void {
    this.router.navigate(['/records', id]);
  }

  toggleSelect(id: number, event: Event): void {
    event.stopPropagation();
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedIds.size === this.records.length) {
      this.selectedIds.clear();
    } else {
      this.records.forEach(r => this.selectedIds.add(r.id));
    }
  }

  isAllSelected(): boolean {
    return this.records.length > 0 && this.selectedIds.size === this.records.length;
  }

  onPageChange(newPage: number): void {
    this.page = newPage;
    this.loadWarnings();
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.pageSize);
  }

  openBatchDialog(): void {
    if (this.selectedIds.size === 0) return;
    this.batchComment = '';
    this.batchResults = null;
    this.showBatchDialog = true;
  }

  executeBatch(): void {
    const ids = Array.from(this.selectedIds);
    const recordVersions: Record<number, number> = {};
    for (const id of ids) {
      const record = this.records.find(r => r.id === id);
      if (record) {
        recordVersions[id] = record.version;
      }
    }
    this.api.batchProcess(ids, this.batchAction, this.batchComment, 0, recordVersions).subscribe({
      next: (res) => {
        this.batchResults = res.results || [];
        this.batchSuccessCount = this.batchResults.filter(r => r.success).length;
        this.batchFailCount = this.batchResults.filter(r => !r.success).length;
        this.showBatchDialog = false;
        this.showBatchResultDialog = true;
        this.selectedIds.clear();
        this.loadWarnings();
      },
      error: (err) => alert(err.error?.error || '批量处理失败'),
    });
  }

  closeBatchResult(): void {
    this.showBatchResultDialog = false;
    this.batchResults = null;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
