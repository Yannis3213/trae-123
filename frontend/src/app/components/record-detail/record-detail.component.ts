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

  canPerformAction(action: ProcessAction): boolean {
    if (!this.record || !this.auth.currentUserValue) return false;
    const role = this.auth.currentUserValue.role;
    const status = this.record.status;
    if (role === 'checkin_agent' && status === 'draft' && action === 'submit') return true;
    if (role === 'checkin_agent' && status === 'returned' && action === 'correct') return true;
    if (role === 'baggage_supervisor' && status === 'pending_review' && action === 'approve') return true;
    if (role === 'baggage_supervisor' && status === 'pending_review' && action === 'return') return true;
    if (role === 'station_manager' && status === 'approved' && action === 'confirm_sync') return true;
    return false;
  }

  getAvailableActions(): ProcessAction[] {
    const actions: ProcessAction[] = [];
    if (this.canPerformAction('submit')) actions.push('submit');
    if (this.canPerformAction('correct')) actions.push('correct');
    if (this.canPerformAction('approve')) actions.push('approve');
    if (this.canPerformAction('return')) actions.push('return');
    if (this.canPerformAction('confirm_sync')) actions.push('confirm_sync');
    return actions;
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
        alert(err.error?.error || '操作失败');
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
