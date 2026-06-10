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
  AttachmentType,
  ATTACHMENT_TYPE_LABELS,
  BatchProcessResult,
} from '../../models/models';

@Component({
  selector: 'app-record-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './record-list.component.html',
  styleUrl: './record-list.component.css',
})
export class RecordListComponent implements OnInit {
  records: CheckinRecord[] = [];
  total = 0;
  page = 1;
  pageSize = 20;

  filterStatus = '';
  filterFlightNo = '';
  filterPassengerName = '';

  selectedIds = new Set<number>();
  batchAction: ProcessAction = 'submit';
  batchComment = '';
  batchResults: BatchProcessResult[] | null = null;
  batchSuccessCount = 0;
  batchFailCount = 0;
  showBatchDialog = false;
  showBatchResultDialog = false;

  hoveredRecordId: number | null = null;
  evidenceData: Record<number, Record<AttachmentType, string[]>> = {};

  showRoleSwitcher = false;
  demoAccounts = [
    { label: '值机员 - 张值机', username: 'zhiJiYuan', password: '123456' },
    { label: '行李主管 - 李行李', username: 'xingLiZhuGuan', password: '123456' },
    { label: '站点经理 - 王站长', username: 'zhanDianJingLi', password: '123456' },
  ];

  activeTab = 'records';

  statusOptions: { value: string; label: string }[] = [
    { value: '', label: '全部' },
    { value: 'draft', label: '草稿' },
    { value: 'pending_review', label: '待审核' },
    { value: 'approved', label: '审核通过' },
    { value: 'synced', label: '已同步' },
    { value: 'returned', label: '退回补正' },
  ];

  batchActionOptions: { value: ProcessAction; label: string }[] = [
    { value: 'submit', label: '提交审核' },
    { value: 'approve', label: '审核通过' },
    { value: 'return', label: '退回补正' },
    { value: 'confirm_sync', label: '确认同步' },
    { value: 'correct', label: '补正提交' },
  ];

  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;
  ROLE_LABELS = ROLE_LABELS;
  WARNING_COLORS = WARNING_COLORS;
  ATTACHMENT_TYPE_LABELS = ATTACHMENT_TYPE_LABELS;

  ERROR_TYPE_LABELS: Record<string, string> = {
    version: '版本冲突',
    role: '角色越权',
    status: '状态冲突',
    evidence: '缺少证据',
    deadline: '已逾期',
    return_reason: '缺少退回原因',
    not_found: '记录不存在',
    invalid_input: '参数错误',
    internal: '系统错误',
  };

  ERROR_TYPE_COLORS: Record<string, string> = {
    version: '#8e44ad',
    role: '#e74c3c',
    status: '#e67e22',
    evidence: '#d35400',
    deadline: '#c0392b',
    return_reason: '#7f8c8d',
    not_found: '#95a5a6',
    invalid_input: '#34495e',
    internal: '#2c3e50',
  };

  attachmentTypes: AttachmentType[] = ['checkin_evidence', 'baggage_evidence', 'exception_evidence'];

  constructor(public auth: AuthService, private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loadRecords();
  }

  loadRecords(): void {
    this.api.getRecords({
      status: this.filterStatus || undefined,
      flight_no: this.filterFlightNo || undefined,
      passenger_name: this.filterPassengerName || undefined,
      page: this.page,
      page_size: this.pageSize,
    }).subscribe({
      next: (res) => {
        this.records = res.data || [];
        this.total = res.total;
        this.loadEvidenceForRecords();
      },
      error: (err) => console.error('加载记录失败', err),
    });
  }

  loadEvidenceForRecords(): void {
    for (const record of this.records) {
      this.api.getRecordDetail(record.id).subscribe({
        next: (detail) => {
          const grouped: Record<AttachmentType, string[]> = {
            checkin_evidence: [],
            baggage_evidence: [],
            exception_evidence: [],
          };
          for (const att of detail.attachments) {
            grouped[att.type].push(att.file_name);
          }
          this.evidenceData[record.id] = grouped;
        },
        error: () => {},
      });
    }
  }

  onFilter(): void {
    this.page = 1;
    this.loadRecords();
  }

  onPageChange(newPage: number): void {
    this.page = newPage;
    this.loadRecords();
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.pageSize);
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

  getDeadlineClass(deadline: string): string {
    const dl = new Date(deadline).getTime();
    const now = Date.now();
    const hours72 = 72 * 60 * 60 * 1000;
    const hours24 = 24 * 60 * 60 * 1000;
    if (dl - now <= hours24) return 'overdue';
    if (dl - now <= hours72) return 'approaching';
    return 'normal';
  }

  getDeadlineColor(deadline: string): string {
    const cls = this.getDeadlineClass(deadline);
    if (cls === 'overdue') return WARNING_COLORS.overdue;
    if (cls === 'approaching') return WARNING_COLORS.approaching;
    return '#2c3e50';
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
        this.loadRecords();
      },
      error: (err) => {
        alert(err.error?.error || '批量处理失败');
      },
    });
  }

  closeBatchResult(): void {
    this.showBatchResultDialog = false;
    this.batchResults = null;
  }

  navigateToDetail(id: number): void {
    this.router.navigate(['/records', id]);
  }

  setHoveredRecord(id: number): void {
    this.hoveredRecordId = id;
  }

  clearHoveredRecord(): void {
  }

  getEvidenceCount(recordId: number, type: AttachmentType): number {
    return this.evidenceData[recordId]?.[type]?.length || 0;
  }

  getEvidenceFirstFile(recordId: number, type: AttachmentType): string {
    const files = this.evidenceData[recordId]?.[type] || [];
    return files.length > 0 ? files[0] : '';
  }

  switchRole(account: { username: string; password: string }): void {
    this.auth.switchRole(account.username, account.password).subscribe({
      next: () => {
        this.showRoleSwitcher = false;
        this.loadRecords();
      },
      error: (err) => alert(err.error?.error || '切换角色失败'),
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'records') {
      this.router.navigate(['/records']);
    } else if (tab === 'warnings') {
      this.router.navigate(['/warnings']);
    } else if (tab === 'statistics') {
      this.router.navigate(['/statistics']);
    }
  }
}
