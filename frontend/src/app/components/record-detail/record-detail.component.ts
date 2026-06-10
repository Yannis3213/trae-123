import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import {
  RecordDetail,
  RecordStatus,
  UserRole,
  ProcessAction,
  AttachmentType,
  Attachment,
  ProcessingRecord,
  AuditNote,
  ExceptionReason,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
  ACTION_LABELS,
  ATTACHMENT_TYPE_LABELS,
} from '../../models/models';

@Component({
  selector: 'app-record-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './record-detail.component.html',
  styleUrl: './record-detail.component.css',
})
export class RecordDetailComponent implements OnInit {
  record!: RecordDetail;
  loading = true;
  error = '';
  activeTab = 'basic';

  processComment = '';
  processing = false;
  showActionDialog = false;
  pendingAction: ProcessAction | null = null;

  newFileName = '';
  newAttachmentType: AttachmentType = 'checkin_evidence';
  uploadingAttachment = false;

  newAuditNote = '';
  addingAuditNote = false;

  newExceptionReasonType = '';
  newExceptionDescription = '';
  addingExceptionReason = false;

  exceptionReasonTypes = ['late_checkin', 'missing_baggage', 'system_error', 'manual_override', 'other'];

  STATUS_LABELS = STATUS_LABELS;
  STATUS_COLORS = STATUS_COLORS;
  ROLE_LABELS = ROLE_LABELS;
  ACTION_LABELS = ACTION_LABELS;
  ATTACHMENT_TYPE_LABELS = ATTACHMENT_TYPE_LABELS;

  attachmentTypes: AttachmentType[] = ['checkin_evidence', 'baggage_evidence', 'exception_evidence'];

  WARNING_LABELS: Record<string, string> = {
    normal: '正常',
    approaching: '临期',
    overdue: '逾期',
  };

  WARNING_COLORS: Record<string, string> = {
    normal: '#27ae60',
    approaching: '#f39c12',
    overdue: '#e74c3c',
  };

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadDetail(id);
    }
  }

  loadDetail(id: number): void {
    this.loading = true;
    this.api.getRecordDetail(id).subscribe({
      next: (detail) => {
        this.record = detail;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || '加载记录详情失败';
        this.loading = false;
      },
    });
  }

  getAttachmentsByType(type: AttachmentType): Attachment[] {
    return this.record.attachments.filter(a => a.type === type);
  }

  isOverdue(): boolean {
    return this.record?.deadline_info?.warning_type === 'overdue';
  }

  isApproaching(): boolean {
    return this.record?.deadline_info?.warning_type === 'approaching';
  }

  getWarningLabel(): string {
    return this.record?.deadline_info?.label || '';
  }

  getWarningColor(): string {
    return this.WARNING_COLORS[this.record?.deadline_info?.warning_type || 'normal'];
  }

  openActionDialog(action: ProcessAction): void {
    this.pendingAction = action;
    this.processComment = '';
    this.showActionDialog = true;
  }

  executeAction(): void {
    if (!this.pendingAction || !this.record) return;
    if (this.pendingAction === 'return' && !this.processComment.trim()) {
      alert('退回补正必须填写原因');
      return;
    }
    this.processing = true;
    this.api.processRecord(this.record.id, this.pendingAction, this.processComment, this.record.version).subscribe({
      next: () => {
        this.processing = false;
        this.showActionDialog = false;
        this.loadDetail(this.record.id);
      },
      error: (err) => {
        this.processing = false;
        const errType = err.error?.error_type;
        const errMsg = err.error?.error || '操作失败';
        const errLabel = this.ERROR_TYPE_LABELS[errType] || '操作失败';
        alert(`【${errLabel}】${errMsg}`);
        this.showActionDialog = false;
      },
    });
  }

  uploadAttachment(): void {
    if (!this.newFileName.trim()) return;
    this.uploadingAttachment = true;
    this.api.uploadAttachment(this.record.id, this.newAttachmentType, this.newFileName.trim()).subscribe({
      next: () => {
        this.uploadingAttachment = false;
        this.newFileName = '';
        this.loadDetail(this.record.id);
      },
      error: (err) => {
        this.uploadingAttachment = false;
        alert(err.error?.error || '上传附件失败');
      },
    });
  }

  deleteAttachment(attachmentId: number): void {
    if (!confirm('确定删除此附件？')) return;
    this.api.deleteAttachment(this.record.id, attachmentId).subscribe({
      next: () => this.loadDetail(this.record.id),
      error: (err) => alert(err.error?.error || '删除附件失败'),
    });
  }

  addAuditNote(): void {
    if (!this.newAuditNote.trim()) return;
    this.addingAuditNote = true;
    this.api.addAuditNote(this.record.id, this.newAuditNote.trim()).subscribe({
      next: () => {
        this.addingAuditNote = false;
        this.newAuditNote = '';
        this.loadDetail(this.record.id);
      },
      error: (err) => {
        this.addingAuditNote = false;
        alert(err.error?.error || '添加备注失败');
      },
    });
  }

  addExceptionReason(): void {
    if (!this.newExceptionReasonType || !this.newExceptionDescription.trim()) return;
    this.addingExceptionReason = true;
    this.api.addExceptionReason(this.record.id, this.newExceptionReasonType, this.newExceptionDescription.trim()).subscribe({
      next: () => {
        this.addingExceptionReason = false;
        this.newExceptionReasonType = '';
        this.newExceptionDescription = '';
        this.loadDetail(this.record.id);
      },
      error: (err) => {
        this.addingExceptionReason = false;
        alert(err.error?.error || '添加异常原因失败');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/records']);
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

  getActionLabel(action: ProcessAction): string {
    return ACTION_LABELS[action] || action;
  }
}
