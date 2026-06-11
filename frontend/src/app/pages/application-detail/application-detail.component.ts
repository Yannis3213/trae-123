import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LoanService } from '../../services/loan.service';
import { AuthService } from '../../services/auth.service';
import {
  LoanApplication,
  Attachment,
  ProcessingRecord,
  AuditNote,
  ExceptionReason,
  User
} from '../../models/loan.model';

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

const ACTION_NAMES: { [key: string]: string } = {
  CREATE: '创建',
  SUBMIT: '提交申请',
  RESUBMIT: '重新提交',
  VERIFY_PASS: '核验通过',
  VERIFY_FAIL: '核验不通过',
  RETURN_CORRECTION: '退回补正',
  APPROVE: '审批通过',
  REJECT: '审批拒绝',
  COMPLETE: '放款完成',
  ARCHIVE: '归档',
  UNARCHIVE: '解除归档',
  RESOLVE_EXCEPTION: '解除异常',
  REVIEW: '复核备注',
  BATCH_VERIFY_PASS: '批量核验通过',
  BATCH_VERIFY_FAIL: '批量核验不通过',
  BATCH_APPROVE: '批量审批通过',
  BATCH_REJECT: '批量审批拒绝',
  BATCH_RETURN: '批量退回',
  BATCH_ARCHIVE: '批量归档'
};

const EXCEPTION_NAMES: { [key: string]: string } = {
  MISSING_EVIDENCE: '缺证据',
  VERSION_CONFLICT: '版本冲突',
  TIMEOUT: '超时',
  VERIFICATION_FAILED: '核验失败',
  RETURNED: '退回补正',
  REJECTED: '审批拒绝'
};

const ATTACHMENT_NAMES: { [key: string]: string } = {
  ID_CARD: '身份证',
  INCOME_PROOF: '收入证明',
  CREDIT_REPORT: '征信报告',
  VERIFICATION_RECORD: '核验记录',
  APPROVAL_OPINION: '审批意见',
  DISBURSEMENT_VOUCHER: '放款凭证'
};

const ROLE_NAMES: { [key: string]: string } = {
  CREDIT_OFFICER: '信贷员',
  RISK_AUDITOR: '风控审核员',
  LOAN_SUPERVISOR: '贷后主管'
};

@Component({
  selector: 'app-application-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="detail-page" *ngIf="application">
      <div class="detail-header">
        <div>
          <a class="back-link" routerLink="/">&larr; 返回列表</a>
          <h2>借款申请单详情</h2>
        </div>
        <div class="header-status">
          <span class="status-badge large" [ngClass]="'status-' + application.status">
            {{ STATUS_NAMES[application.status] || application.status }}
          </span>
          <span *ngIf="isArchived" class="status-badge large status-ARCHIVED">
            📁 已归档
          </span>
          <span class="due-badge" [ngClass]="'due-' + application.dueStatus">
            {{ dueLabel(application.dueStatus) }}
          </span>
        </div>
      </div>

      <div class="detail-layout">
        <div class="detail-main">
          <div class="card">
            <div class="card-title">基本信息</div>
            <div class="info-grid">
              <div class="info-item">
                <label>申请单号</label>
                <span class="mono">{{ application.application_no }}</span>
              </div>
              <div class="info-item">
                <label>申请人</label>
                <span>{{ application.applicant_name }}</span>
              </div>
              <div class="info-item">
                <label>身份证号</label>
                <span class="mono">{{ application.id_card }}</span>
              </div>
              <div class="info-item">
                <label>联系电话</label>
                <span>{{ application.phone }}</span>
              </div>
              <div class="info-item">
                <label>借款金额</label>
                <span class="amount">¥{{ application.amount.toLocaleString() }}</span>
              </div>
              <div class="info-item">
                <label>借款期限</label>
                <span>{{ application.term_months }}个月</span>
              </div>
              <div class="info-item">
                <label>借款用途</label>
                <span>{{ application.purpose || '-' }}</span>
              </div>
              <div class="info-item">
                <label>当前节点</label>
                <span>{{ NODE_NAMES[application.current_node] || application.current_node }}</span>
              </div>
              <div class="info-item">
                <label>创建人</label>
                <span>{{ application.created_by }}</span>
              </div>
              <div class="info-item">
                <label>当前处理人</label>
                <span>{{ application.current_handler || '-' }}</span>
              </div>
              <div class="info-item">
                <label>核验到期日</label>
                <span [class.text-danger]="isOverdue(application.verification_due_date)">
                  {{ application.verification_due_date | slice:0:10 }}
                </span>
              </div>
              <div class="info-item">
                <label>到期日</label>
                <span>{{ application.due_date | slice:0:10 }}</span>
              </div>
              <div class="info-item full">
                <label>备注</label>
                <span>{{ application.remark || '-' }}</span>
              </div>
              <div class="info-item">
                <label>版本号</label>
                <span class="mono">v{{ application.version }}</span>
              </div>
              <div class="info-item">
                <label>更新时间</label>
                <span>{{ application.updated_at | slice:0:19 }}</span>
              </div>
              <div class="info-item" *ngIf="isArchived">
                <label>归档时间</label>
                <span>{{ application.archived_at | slice:0:19 }}</span>
              </div>
              <div class="info-item" *ngIf="isArchived">
                <label>归档人</label>
                <span>{{ application.archived_by }}</span>
              </div>
              <div class="info-item" *ngIf="application.review_note">
                <label>复核人</label>
                <span>{{ application.reviewed_by }}</span>
              </div>
              <div class="info-item" *ngIf="application.review_note">
                <label>复核时间</label>
                <span>{{ application.reviewed_at | slice:0:19 }}</span>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="application.review_note">
            <div class="card-title">复核备注</div>
            <div class="review-note">
              <p>{{ application.review_note }}</p>
              <p class="review-meta">
                复核人：{{ application.reviewed_by }} · {{ application.reviewed_at | slice:0:19 }}
              </p>
            </div>
          </div>

          <div class="card" *ngIf="canAct">
            <div class="card-title">办理操作</div>
            <div class="action-section">
              <p class="tip" *ngIf="isRiskAuditor && isVerificationOverdue">
                ⚠️ 核验已超时，不允许通过操作，仅可退回补正
              </p>

              <div *ngIf="isCreditOfficer && (status === 'DRAFT' || status === 'CORRECTION_REQUIRED')">
                <p class="action-desc">提交申请至风控审核，系统将校验必填材料是否齐全</p>
                <textarea [(ngModel)]="actionRemark" rows="2" placeholder="备注（可选）"></textarea>
                <button class="btn-primary" (click)="doSubmit()">提交申请</button>
              </div>

              <div *ngIf="isRiskAuditor && status === 'PENDING_VERIFICATION'" class="action-buttons">
                <div class="action-group">
                  <button class="btn-success" [disabled]="isVerificationOverdue" (click)="doVerify('PASS')">
                    核验通过
                  </button>
                  <button class="btn-danger" (click)="doVerify('FAIL')">核验不通过</button>
                  <button class="btn-warning" (click)="doVerify('RETURN')">退回补正</button>
                </div>
                <textarea [(ngModel)]="actionRemark" rows="2" placeholder="请输入处理意见"></textarea>
                <p class="hint">操作前请确认核验证据是否齐全，系统将自动校验</p>
              </div>

              <div *ngIf="isSupervisor && status === 'VERIFICATION_PASSED'" class="action-buttons">
                <div class="action-group">
                  <button class="btn-success" (click)="doApprove('APPROVE')">审批通过</button>
                  <button class="btn-danger" (click)="doApprove('REJECT')">审批拒绝</button>
                  <button class="btn-warning" (click)="doApprove('RETURN')">退回补正</button>
                </div>
                <textarea [(ngModel)]="actionRemark" rows="2" placeholder="请输入审批意见"></textarea>
              </div>

              <div *ngIf="isSupervisor && status === 'APPROVED'">
                <p class="action-desc">确认放款，完成整个借款流程</p>
                <button class="btn-primary" (click)="doComplete()">确认放款完成</button>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="canArchive || canUnarchive">
            <div class="card-title">月底归档操作</div>
            <div class="action-section">
              <p *ngIf="isArchived" class="tip">
                📁 该单据已归档，所有编辑操作已冻结。如需修改，请先解除归档。
              </p>
              <p *ngIf="!isArchived" class="action-desc">
                归档后，单据将被冻结，不可进行提交、核验、审批、上传附件、添加备注等操作。
              </p>
              <div class="action-buttons">
                <button *ngIf="canArchive" class="btn-secondary" (click)="doArchive()">
                  📁 月底归档
                </button>
                <button *ngIf="canUnarchive" class="btn-secondary" (click)="doUnarchive()">
                  🔓 解除归档
                </button>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="canReview">
            <div class="card-title">复核备注</div>
            <div class="action-section">
              <p class="action-desc">贷后主管月底复核时添加的备注，将永久留痕。</p>
              <textarea [(ngModel)]="newReviewNote" rows="3" placeholder="请输入复核备注..."></textarea>
              <button class="btn-secondary" (click)="doAddReview()">保存复核备注</button>
            </div>
          </div>

          <div class="card" *ngIf="canUploadAttachments">
            <div class="card-title">
              证据上传
              <span class="card-subtitle">（按当前节点和角色上传对应证据）</span>
            </div>

            <div class="upload-section" *ngIf="canUploadApplication">
              <div class="upload-section-title">📋 借款申请证据 <span class="required-tag">信贷员上传</span></div>
              <div class="upload-tip">
                <span *ngIf="!evidenceSummary?.APPLICATION?.complete" class="text-danger">
                  ⚠️ 必填证据不齐全：{{ getMissingNames('APPLICATION') }}
                </span>
                <span *ngIf="evidenceSummary?.APPLICATION?.complete" class="text-success">
                  ✓ 借款申请证据已齐全
                </span>
              </div>
              <div class="attach-form">
                <select [(ngModel)]="newAttach.type">
                  <option value="">选择证据类型</option>
                  <option value="ID_CARD">身份证</option>
                  <option value="INCOME_PROOF">收入证明</option>
                </select>
                <input type="text" [(ngModel)]="newAttach.name" placeholder="证据名称（可选）">
                <button class="btn-secondary" (click)="addAttachment('APPLICATION')">上传申请证据</button>
              </div>
            </div>

            <div class="upload-section" *ngIf="canUploadVerification">
              <div class="upload-section-title">🔍 资料核验证据 <span class="required-tag">风控上传</span></div>
              <div class="upload-tip">
                <span *ngIf="!evidenceSummary?.VERIFICATION?.complete" class="text-danger">
                  ⚠️ 必填证据不齐全：{{ getMissingNames('VERIFICATION') }}
                </span>
                <span *ngIf="evidenceSummary?.VERIFICATION?.complete" class="text-success">
                  ✓ 资料核验证据已齐全
                </span>
              </div>
              <div class="attach-form">
                <select [(ngModel)]="newAttach.type">
                  <option value="">选择证据类型</option>
                  <option value="CREDIT_REPORT">征信报告</option>
                  <option value="VERIFICATION_RECORD">核验记录</option>
                </select>
                <input type="text" [(ngModel)]="newAttach.name" placeholder="证据名称（可选）">
                <button class="btn-secondary" (click)="addAttachment('VERIFICATION')">上传核验证据</button>
              </div>
            </div>

            <div class="upload-section" *ngIf="canUploadApproval">
              <div class="upload-section-title">✅ 审批放款证据 <span class="required-tag">主管上传</span></div>
              <div class="upload-tip">
                <span *ngIf="!evidenceSummary?.APPROVAL?.complete" class="text-danger">
                  ⚠️ 必填证据不齐全：{{ getMissingNames('APPROVAL') }}
                </span>
                <span *ngIf="evidenceSummary?.APPROVAL?.complete" class="text-success">
                  ✓ 审批放款证据已齐全
                </span>
              </div>
              <div class="attach-form">
                <select [(ngModel)]="newAttach.type">
                  <option value="">选择证据类型</option>
                  <option value="APPROVAL_OPINION">审批意见</option>
                  <option value="DISBURSEMENT_VOUCHER">放款凭证</option>
                </select>
                <input type="text" [(ngModel)]="newAttach.name" placeholder="证据名称（可选）">
                <button class="btn-secondary" (click)="addAttachment('APPROVAL')">上传审批证据</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">处理记录（审计轨迹）</div>
            <div class="timeline">
              <div *ngFor="let record of records" class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-action">{{ ACTION_NAMES[record.action] || record.action }}</span>
                    <span class="timeline-time">{{ record.created_at | slice:0:19 }}</span>
                  </div>
                  <div class="timeline-meta">
                    <span>{{ record.handler }}</span>
                    <span class="role-tag">{{ ROLE_NAMES[record.handler_role] || record.handler_role }}</span>
                    <span>节点: {{ NODE_NAMES[record.node] || record.node }}</span>
                  </div>
                  <div class="timeline-status">
                    <span *ngIf="record.from_status" class="status-badge small"
                          [ngClass]="'status-' + record.from_status">
                      {{ STATUS_NAMES[record.from_status] || record.from_status }}
                    </span>
                    <span *ngIf="record.from_status"> → </span>
                    <span class="status-badge small" [ngClass]="'status-' + record.to_status">
                      {{ STATUS_NAMES[record.to_status] || record.to_status }}
                    </span>
                  </div>
                  <div *ngIf="record.remark" class="timeline-remark">{{ record.remark }}</div>
                </div>
              </div>
              <div *ngIf="records.length === 0" class="empty">暂无处理记录</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">审计备注</div>
            <div class="audit-notes">
              <div *ngFor="let note of auditNotes" class="audit-note">
                <div class="note-header">
                  <span class="note-user">{{ note.created_by }}</span>
                  <span class="note-time">{{ note.created_at | slice:0:19 }}</span>
                </div>
                <div class="note-content">{{ note.note }}</div>
              </div>
              <div *ngIf="auditNotes.length === 0" class="empty">暂无审计备注</div>
              <div class="note-input">
                <textarea [(ngModel)]="newAuditNote" rows="2" placeholder="添加审计备注..."></textarea>
                <button class="btn-secondary" (click)="addAuditNote()">添加备注</button>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-sidebar">
          <div class="card">
            <div class="card-title">证据摘要</div>
            <div class="evidence-summary">
              <div class="evidence-node">
                <div class="node-header">
                  <span class="node-name">📋 借款申请</span>
                  <span class="node-status"
                        [ngClass]="evidenceSummary?.APPLICATION?.complete ? 'complete' : 'incomplete'">
                    {{ evidenceSummary?.APPLICATION?.complete ? '齐全' : '不齐全' }}
                  </span>
                </div>
                <div class="evidence-items">
                  <div *ngFor="let item of evidenceSummary?.APPLICATION?.missing || []"
                       class="evidence-item missing">
                    <span class="dot"></span>
                    <span>缺少：{{ item.name }}</span>
                  </div>
                  <div *ngIf="evidenceSummary?.APPLICATION?.complete"
                       class="evidence-item complete">
                    <span class="dot"></span>
                    <span>必填证据已齐全</span>
                  </div>
                </div>
              </div>

              <div class="evidence-node">
                <div class="node-header">
                  <span class="node-name">🔍 资料核验</span>
                  <span class="node-status"
                        [ngClass]="evidenceSummary?.VERIFICATION?.complete ? 'complete' : 'incomplete'">
                    {{ evidenceSummary?.VERIFICATION?.complete ? '齐全' : '不齐全' }}
                  </span>
                </div>
                <div class="evidence-items">
                  <div *ngFor="let item of evidenceSummary?.VERIFICATION?.missing || []"
                       class="evidence-item missing">
                    <span class="dot"></span>
                    <span>缺少：{{ item.name }}</span>
                  </div>
                  <div *ngIf="evidenceSummary?.VERIFICATION?.complete"
                       class="evidence-item complete">
                    <span class="dot"></span>
                    <span>必填证据已齐全</span>
                  </div>
                </div>
              </div>

              <div class="evidence-node">
                <div class="node-header">
                  <span class="node-name">✅ 审批放款</span>
                  <span class="node-status"
                        [ngClass]="evidenceSummary?.APPROVAL?.complete ? 'complete' : 'incomplete'">
                    {{ evidenceSummary?.APPROVAL?.complete ? '齐全' : '不齐全' }}
                  </span>
                </div>
                <div class="evidence-items">
                  <div *ngFor="let item of evidenceSummary?.APPROVAL?.missing || []"
                       class="evidence-item missing">
                    <span class="dot"></span>
                    <span>缺少：{{ item.name }}</span>
                  </div>
                  <div *ngIf="evidenceSummary?.APPROVAL?.complete"
                       class="evidence-item complete">
                    <span class="dot"></span>
                    <span>必填证据已齐全</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">附件列表</div>
            <div class="attach-list">
              <div *ngFor="let att of attachments" class="attach-item">
                <span class="attach-icon">📎</span>
                <div class="attach-info">
                  <div class="attach-name">{{ att.attach_name }}</div>
                  <div class="attach-meta">
                    {{ ATTACHMENT_NAMES[att.attach_type] || att.attach_type }}
                    <span *ngIf="att.is_required" class="required-tag">必填</span>
                    · {{ att.uploaded_by }}
                  </div>
                </div>
              </div>
              <div *ngIf="attachments.length === 0" class="empty">暂无附件</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">异常原因</div>
            <div class="exception-list">
              <div *ngFor="let exc of exceptions" class="exception-item"
                   [class.resolved]="!!exc.resolved_at">
                <div class="exc-header">
                  <span class="exc-type">{{ EXCEPTION_NAMES[exc.exception_type] || exc.exception_type }}</span>
                  <span class="exc-time">{{ exc.detected_at | slice:0:10 }}</span>
                  <span *ngIf="exc.resolved_at" class="exc-resolved">✓ 已解除</span>
                </div>
                <div class="exc-reason">{{ exc.reason }}</div>
                <div *ngIf="exc.detail" class="exc-detail">{{ exc.detail }}</div>
                <div class="exc-meta">发现人：{{ exc.detected_by }}</div>
                <div *ngIf="exc.resolved_at" class="exc-resolution">
                  <span class="text-success">解除：{{ exc.resolution }}</span>
                  <span class="exc-meta">解除人：{{ exc.resolved_by }} · {{ exc.resolved_at | slice:0:19 }}</span>
                </div>
                <div *ngIf="isSupervisor && !isArchived && !exc.resolved_at" class="exc-resolve-form">
                  <textarea [(ngModel)]="resolutionMap[exc.id]" rows="2"
                            placeholder="请输入解除异常的说明..."></textarea>
                  <button class="btn-secondary" (click)="doResolveException(exc)">解除异常</button>
                </div>
              </div>
              <div *ngIf="exceptions.length === 0" class="empty">暂无异常记录</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">补正动作</div>
            <div class="correction-info">
              <p *ngIf="status === 'CORRECTION_REQUIRED'" class="text-warning">
                ⚠️ 当前处于退回补正状态，请按要求补正材料后重新提交
              </p>
              <p *ngIf="status !== 'CORRECTION_REQUIRED'" class="text-muted">
                无待补正项
              </p>
              <div *ngIf="latestReturnException" class="correction-detail">
                <div class="corr-title">最近退回原因：</div>
                <div class="corr-reason">{{ latestReturnException.reason }}</div>
                <div *ngIf="latestReturnException.detail" class="corr-detail-text">
                  {{ latestReturnException.detail }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-page { display: flex; flex-direction: column; gap: 16px; }
    .detail-header {
      display: flex; justify-content: space-between; align-items: center;
      background: white; padding: 16px 20px; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .back-link { color: #2c5282; text-decoration: none; font-size: 13px; }
    .detail-header h2 { margin: 8px 0 0 0; color: #1e3a5f; }
    .header-status { display: flex; gap: 10px; align-items: center; }

    .detail-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
    .detail-main { display: flex; flex-direction: column; gap: 16px; }
    .detail-sidebar { display: flex; flex-direction: column; gap: 16px; }

    .card {
      background: white; border-radius: 8px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .card-title {
      font-size: 15px; font-weight: 600; color: #1e3a5f;
      margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;
    }
    .card-subtitle { font-size: 12px; font-weight: normal; color: #718096; margin-left: 8px; }

    .info-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
    }
    .info-item.full { grid-column: span 3; }
    .info-item label {
      display: block; font-size: 12px; color: #718096; margin-bottom: 4px;
    }
    .info-item span { font-size: 14px; color: #2d3748; }
    .info-item .mono { font-family: monospace; }
    .info-item .amount { color: #e53e3e; font-weight: 600; }
    .text-danger { color: #e53e3e; font-weight: 500; }

    .status-badge {
      display: inline-block; padding: 3px 10px; border-radius: 12px;
      font-size: 12px; font-weight: 500;
    }
    .status-badge.large { padding: 6px 16px; font-size: 14px; }
    .status-badge.small { padding: 2px 8px; font-size: 11px; }
    .status-DRAFT { background: #edf2f7; color: #4a5568; }
    .status-PENDING_VERIFICATION { background: #bee3f8; color: #2b6cb0; }
    .status-VERIFICATION_PASSED { background: #c6f6d5; color: #276749; }
    .status-VERIFICATION_FAILED { background: #fed7d7; color: #c53030; }
    .status-CORRECTION_REQUIRED { background: #feebc8; color: #c05621; }
    .status-APPROVED { background: #c6f6d5; color: #276749; }
    .status-REJECTED { background: #fed7d7; color: #c53030; }
    .status-COMPLETED { background: #e9d8fd; color: #553c9a; }

    .due-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
    .due-normal { background: #c6f6d5; color: #276749; }
    .due-approaching { background: #feebc8; color: #c05621; }
    .due-overdue { background: #fed7d7; color: #c53030; }

    .action-section { padding: 10px 0; }
    .action-desc { color: #4a5568; font-size: 13px; margin-bottom: 10px; }
    .action-buttons { display: flex; flex-direction: column; gap: 10px; }
    .action-group { display: flex; gap: 10px; }
    .tip { color: #dd6b20; background: #fffaf0; padding: 8px 12px; border-radius: 4px; font-size: 13px; }
    .hint { color: #718096; font-size: 12px; }
    textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0;
      border-radius: 4px; font-size: 13px; box-sizing: border-box; resize: vertical;
      font-family: inherit;
    }

    .btn-primary { padding: 8px 20px; background: #2c5282; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-primary:hover { background: #1e3a5f; }
    .btn-primary:disabled { background: #a0aec0; cursor: not-allowed; }
    .btn-secondary { padding: 8px 16px; background: white; color: #2c5282; border: 1px solid #2c5282; border-radius: 4px; cursor: pointer; }
    .btn-secondary:hover { background: #f0f7ff; }
    .btn-success { padding: 8px 16px; background: #38a169; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-success:hover { background: #276749; }
    .btn-success:disabled { background: #9ae6b4; cursor: not-allowed; }
    .btn-danger { padding: 8px 16px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-danger:hover { background: #c53030; }
    .btn-warning { padding: 8px 16px; background: #dd6b20; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .btn-warning:hover { background: #c05621; }

    .timeline { position: relative; padding-left: 24px; }
    .timeline-item { position: relative; padding-bottom: 20px; }
    .timeline-item:last-child { padding-bottom: 0; }
    .timeline-dot {
      position: absolute; left: -24px; top: 4px; width: 12px; height: 12px;
      border-radius: 50%; background: #2c5282; border: 2px solid white;
      box-shadow: 0 0 0 2px #bee3f8;
    }
    .timeline-item::before {
      content: ''; position: absolute; left: -19px; top: 16px; bottom: 0;
      width: 2px; background: #e2e8f0;
    }
    .timeline-item:last-child::before { display: none; }
    .timeline-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 4px;
    }
    .timeline-action { font-weight: 600; color: #2d3748; font-size: 14px; }
    .timeline-time { font-size: 12px; color: #718096; }
    .timeline-meta {
      display: flex; gap: 8px; font-size: 12px; color: #4a5568;
      margin-bottom: 6px; align-items: center;
    }
    .role-tag {
      background: #edf2f7; color: #4a5568; padding: 1px 6px;
      border-radius: 3px; font-size: 11px;
    }
    .timeline-status { margin-bottom: 6px; }
    .timeline-remark { font-size: 13px; color: #4a5568; background: #f7fafc; padding: 6px 10px; border-radius: 4px; }

    .evidence-summary { display: flex; flex-direction: column; gap: 12px; }
    .evidence-node { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .node-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; background: #f7fafc; font-size: 13px;
    }
    .node-name { font-weight: 500; }
    .node-status { padding: 2px 8px; border-radius: 3px; font-size: 11px; }
    .node-status.complete { background: #c6f6d5; color: #276749; }
    .node-status.incomplete { background: #fed7d7; color: #c53030; }
    .evidence-items { padding: 8px 12px; }
    .evidence-item { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; padding: 3px 0; }
    .evidence-item .dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; }
    .evidence-item.missing { color: #c53030; }
    .evidence-item.missing .dot { background: #e53e3e; }
    .evidence-item.complete { color: #276749; }
    .evidence-item.complete .dot { background: #38a169; }

    .attach-list { display: flex; flex-direction: column; gap: 8px; }
    .attach-item { display: flex; gap: 10px; padding: 8px; background: #f7fafc; border-radius: 4px; }
    .attach-icon { font-size: 18px; }
    .attach-info { flex: 1; min-width: 0; }
    .attach-name { font-size: 13px; color: #2d3748; }
    .attach-meta { font-size: 11px; color: #718096; }
    .required-tag { background: #fed7d7; color: #c53030; padding: 1px 4px; border-radius: 2px; }

    .exception-list { display: flex; flex-direction: column; gap: 10px; }
    .exception-item {
      padding: 10px; border-left: 3px solid #e53e3e;
      background: #fff5f5; border-radius: 0 4px 4px 0;
    }
    .exc-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 4px;
    }
    .exc-type { font-weight: 600; font-size: 13px; color: #c53030; }
    .exc-time { font-size: 11px; color: #718096; }
    .exc-reason { font-size: 13px; color: #2d3748; margin-bottom: 4px; }
    .exc-detail { font-size: 12px; color: #4a5568; margin-bottom: 4px; }
    .exc-meta { font-size: 11px; color: #718096; }

    .correction-info { font-size: 13px; }
    .text-warning { color: #dd6b20; }
    .text-muted { color: #a0aec0; }
    .correction-detail { margin-top: 10px; padding: 10px; background: #fffaf0; border-radius: 4px; }
    .corr-title { font-weight: 600; color: #c05621; margin-bottom: 4px; font-size: 12px; }
    .corr-reason { color: #2d3748; margin-bottom: 4px; }
    .corr-detail-text { font-size: 12px; color: #4a5568; }

    .attach-form { display: flex; gap: 8px; flex-wrap: wrap; }
    .attach-form select, .attach-form input {
      padding: 6px 10px; border: 1px solid #e2e8f0;
      border-radius: 4px; font-size: 13px;
    }
    .attach-form input { flex: 1; min-width: 120px; }

    .upload-section {
      padding: 12px; background: #f7fafc; border-radius: 6px;
      margin-bottom: 12px; border: 1px solid #e2e8f0;
    }
    .upload-section:last-child { margin-bottom: 0; }
    .upload-section-title {
      font-size: 13px; font-weight: 600; color: #2d3748;
      margin-bottom: 8px; display: flex; align-items: center; gap: 8px;
    }
    .upload-tip { font-size: 12px; margin-bottom: 8px; }
    .text-success { color: #38a169; }
    .text-danger { color: #e53e3e; }
    .required-tag {
      background: #fed7d7; color: #c53030; padding: 1px 6px;
      border-radius: 3px; font-size: 10px; font-weight: normal;
    }

    .audit-notes { display: flex; flex-direction: column; gap: 10px; }
    .audit-note {
      padding: 10px 12px; background: #f7fafc; border-radius: 6px;
      border-left: 3px solid #2c5282;
    }
    .note-header {
      display: flex; justify-content: space-between;
      font-size: 12px; color: #718096; margin-bottom: 4px;
    }
    .note-user { font-weight: 500; }
    .note-content { font-size: 13px; color: #2d3748; }
    .note-input { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
    .note-input textarea { width: 100%; }

    .empty { text-align: center; padding: 20px; color: #a0aec0; font-size: 13px; }

    :host ::ng-deep .mono { font-family: monospace; }

    .status-ARCHIVED {
      background: #4a5568 !important;
      color: #fff !important;
    }

    .review-note {
      padding: 12px 15px;
      background: #ebf8ff;
      border-left: 4px solid #2c5282;
      border-radius: 4px;
    }
    .review-note p { margin: 0 0 8px 0; font-size: 13px; color: #2d3748; }
    .review-note p:last-child { margin: 0; }
    .review-meta { font-size: 12px !important; color: #718096 !important; }

    .exception-item.resolved {
      opacity: 0.6;
      background: #f7fafc !important;
    }
    .exc-resolved {
      background: #c6f6d5;
      color: #22543d;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
    }
    .exc-resolution {
      margin-top: 8px;
      padding: 8px 10px;
      background: #f0fff4;
      border-left: 3px solid #38a169;
      border-radius: 3px;
    }
    .exc-resolution .exc-meta {
      display: block;
      margin-top: 4px;
    }
    .exc-resolve-form {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .exc-resolve-form textarea {
      width: 100%;
      min-height: 50px;
    }
    .exc-resolve-form button { align-self: flex-end; }
  `]
})
export class ApplicationDetailComponent implements OnInit {
  application!: LoanApplication;
  attachments: Attachment[] = [];
  records: ProcessingRecord[] = [];
  auditNotes: AuditNote[] = [];
  exceptions: ExceptionReason[] = [];
  evidenceSummary: any = {};

  actionRemark = '';
  newAuditNote = '';
  newAttach = { type: '', name: '' };
  newReviewNote = '';
  resolutionMap: { [key: number]: string } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loanService: LoanService,
    private auth: AuthService
  ) {}

  get currentUser(): User | null { return this.auth.currentUser; }
  get isCreditOfficer(): boolean { return this.currentUser?.role === 'CREDIT_OFFICER'; }
  get isRiskAuditor(): boolean { return this.currentUser?.role === 'RISK_AUDITOR'; }
  get isSupervisor(): boolean { return this.currentUser?.role === 'LOAN_SUPERVISOR'; }
  get status(): string { return this.application?.status || ''; }

  get canAct(): boolean {
    if (!this.application) return false;
    if (this.isArchived) return false;
    const s = this.status;
    if (this.isCreditOfficer && (s === 'DRAFT' || s === 'CORRECTION_REQUIRED')) return true;
    if (this.isRiskAuditor && s === 'PENDING_VERIFICATION') return true;
    if (this.isSupervisor && s === 'VERIFICATION_PASSED') return true;
    if (this.isSupervisor && s === 'APPROVED') return true;
    return false;
  }

  get isArchived(): boolean {
    const v = this.application?.is_archived;
    return v === 1 || v === true;
  }

  get canArchive(): boolean {
    if (!this.application || !this.isSupervisor || this.isArchived) return false;
    const s = this.status;
    return ['COMPLETED', 'VERIFICATION_FAILED', 'REJECTED'].includes(s);
  }

  get canUnarchive(): boolean {
    return this.isSupervisor && this.isArchived;
  }

  get canReview(): boolean {
    if (!this.isSupervisor || this.isArchived) return false;
    const s = this.status;
    return ['COMPLETED', 'VERIFICATION_FAILED', 'REJECTED'].includes(s);
  }

  get isVerificationOverdue(): boolean {
    return this.isOverdue(this.application?.verification_due_date);
  }

  get latestReturnException(): ExceptionReason | null {
    const returns = this.exceptions.filter(e => e.exception_type === 'RETURNED');
    return returns.length > 0 ? returns[0] : null;
  }

  get canUploadAttachments(): boolean {
    if (!this.application || this.isArchived) return false;
    return this.canUploadApplication || this.canUploadVerification || this.canUploadApproval;
  }

  get canUploadApplication(): boolean {
    if (!this.application || !this.isCreditOfficer || this.isArchived) return false;
    const s = this.status;
    if (this.application.created_by !== this.currentUser?.username && s !== 'CORRECTION_REQUIRED') return false;
    return s === 'DRAFT' || s === 'CORRECTION_REQUIRED';
  }

  get canUploadVerification(): boolean {
    if (!this.application || !this.isRiskAuditor || this.isArchived) return false;
    const s = this.status;
    return s === 'PENDING_VERIFICATION' || s === 'CORRECTION_REQUIRED'
      || s === 'VERIFICATION_PASSED';
  }

  get canUploadApproval(): boolean {
    if (!this.application || !this.isSupervisor || this.isArchived) return false;
    const s = this.status;
    return s === 'VERIFICATION_PASSED' || s === 'APPROVED';
  }

  ngOnInit(): void {
    const id = +this.route.snapshot.params['id'];
    this.loadDetail(id);
  }

  loadDetail(id: number): void {
    this.loanService.getApplication(id).subscribe({
      next: (data) => {
        this.application = data;
        this.attachments = data.attachments || [];
        this.records = data.records || [];
        this.auditNotes = data.auditNotes || [];
        this.exceptions = data.exceptions || [];
        this.evidenceSummary = data.evidenceSummary || {};
      },
      error: () => {
        alert('加载失败');
        this.router.navigate(['/']);
      }
    });
  }

  dueLabel(status: string): string {
    const map: { [key: string]: string } = { normal: '正常', approaching: '临期', overdue: '逾期' };
    return map[status] || status;
  }

  getMissingNames(node: string): string {
    const missing = this.evidenceSummary?.[node]?.missing;
    if (!missing || !missing.length) return '';
    return missing.map((m: any) => m.name).join('、');
  }

  doArchive(): void {
    if (!confirm('确认月底归档？归档后所有编辑操作将被冻结，如需修改需先解除归档。')) return;
    this.loanService.archiveApplication(this.application.id, this.application.version).subscribe({
      next: () => {
        alert('归档成功');
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        alert(err.error?.error || '操作失败');
      }
    });
  }

  doUnarchive(): void {
    if (!confirm('确认解除归档？解除后单据恢复可编辑状态。')) return;
    this.loanService.unarchiveApplication(this.application.id, this.application.version).subscribe({
      next: () => {
        alert('解除归档成功');
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        alert(err.error?.error || '操作失败');
      }
    });
  }

  doAddReview(): void {
    if (!this.newReviewNote.trim()) {
      alert('请输入复核备注内容');
      return;
    }
    this.loanService.addReview(this.application.id, this.newReviewNote.trim(), this.application.version).subscribe({
      next: () => {
        alert('复核备注已保存');
        this.newReviewNote = '';
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        alert(err.error?.error || '保存失败');
      }
    });
  }

  doResolveException(exc: ExceptionReason): void {
    const resolution = this.resolutionMap[exc.id];
    if (!resolution || !resolution.trim()) {
      alert('请输入解除异常的说明');
      return;
    }
    if (!confirm('确认解除该异常？解除后该异常记录将标记为已解决。')) return;
    this.loanService.resolveException(this.application.id, exc.id, resolution.trim(), this.application.version).subscribe({
      next: () => {
        alert('异常已解除');
        delete this.resolutionMap[exc.id];
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        alert(err.error?.error || '操作失败');
      }
    });
  }

  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const due = new Date(dateStr);
    return new Date() > due;
  }

  doSubmit(): void {
    if (!confirm('确认提交申请至风控审核？')) return;
    this.loanService.submitApplication(
      this.application.id, this.application.version, this.actionRemark
    ).subscribe({
      next: () => {
        alert('提交成功');
        this.actionRemark = '';
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        const msg = err.error?.error || '提交失败';
        const missing = err.error?.missing;
        if (missing) {
          alert(`${msg}\n缺少：${missing.join('、')}`);
        } else {
          alert(msg);
        }
      }
    });
  }

  doVerify(action: string): void {
    const actionMap: { [key: string]: string } = {
      PASS: '确认核验通过？',
      FAIL: '确认核验不通过？',
      RETURN: '确认退回补正？'
    };
    if (!confirm(actionMap[action] || '确认执行操作？')) return;

    this.loanService.verifyApplication(
      this.application.id, action, this.application.version, this.actionRemark
    ).subscribe({
      next: () => {
        alert('操作成功');
        this.actionRemark = '';
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        const msg = err.error?.error || '操作失败';
        const missing = err.error?.missing;
        if (missing) {
          alert(`${msg}\n缺少：${missing.join('、')}`);
        } else {
          alert(msg);
        }
      }
    });
  }

  doApprove(action: string): void {
    const actionMap: { [key: string]: string } = {
      APPROVE: '确认审批通过？',
      REJECT: '确认审批拒绝？',
      RETURN: '确认退回补正？'
    };
    if (!confirm(actionMap[action] || '确认执行操作？')) return;

    this.loanService.approveApplication(
      this.application.id, action, this.application.version, this.actionRemark
    ).subscribe({
      next: () => {
        alert('操作成功');
        this.actionRemark = '';
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        const msg = err.error?.error || '操作失败';
        const missing = err.error?.missing;
        if (missing) {
          alert(`${msg}\n缺少：${missing.join('、')}`);
        } else {
          alert(msg);
        }
      }
    });
  }

  doComplete(): void {
    if (!confirm('确认放款完成？此操作将结束整个流程。')) return;
    this.loanService.completeApplication(this.application.id, this.application.version).subscribe({
      next: () => {
        alert('操作成功');
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        const msg = err.error?.error || '操作失败';
        const missing = err.error?.missing;
        if (missing) {
          alert(`${msg}\n缺少：${missing.join('、')}`);
        } else {
          alert(msg);
        }
      }
    });
  }

  addAttachment(node: string): void {
    if (!this.newAttach.type) {
      alert('请选择证据类型');
      return;
    }
    const nodeMap: { [key: string]: string } = {
      ID_CARD: 'APPLICATION',
      INCOME_PROOF: 'APPLICATION',
      CREDIT_REPORT: 'VERIFICATION',
      VERIFICATION_RECORD: 'VERIFICATION',
      APPROVAL_OPINION: 'APPROVAL',
      DISBURSEMENT_VOUCHER: 'APPROVAL'
    };
    const actualNode = node || nodeMap[this.newAttach.type] || 'APPLICATION';
    this.loanService.addAttachment(this.application.id, {
      attach_type: this.newAttach.type,
      attach_name: this.newAttach.name || ATTACHMENT_NAMES[this.newAttach.type],
      node: actualNode,
      is_required: 1
    }).subscribe({
      next: () => {
        this.newAttach = { type: '', name: '' };
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        alert(err.error?.error || '添加失败');
      }
    });
  }

  addAuditNote(): void {
    if (!this.newAuditNote.trim()) return;
    this.loanService.addAuditNote(this.application.id, this.newAuditNote.trim()).subscribe({
      next: () => {
        this.newAuditNote = '';
        this.loadDetail(this.application.id);
      },
      error: (err) => {
        alert(err.error?.error || '添加失败');
      }
    });
  }

  protected readonly STATUS_NAMES = STATUS_NAMES;
  protected readonly NODE_NAMES = NODE_NAMES;
  protected readonly ACTION_NAMES = ACTION_NAMES;
  protected readonly EXCEPTION_NAMES = EXCEPTION_NAMES;
  protected readonly ATTACHMENT_NAMES = ATTACHMENT_NAMES;
  protected readonly ROLE_NAMES = ROLE_NAMES;
}
