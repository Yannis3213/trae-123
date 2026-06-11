import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LaunchPlanService } from '../../services/launch-plan.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import {
  LaunchPlan,
  Attachment,
  ProcessRecord,
  AuditNote,
  ExceptionLog,
  User,
} from '../../models/launch-plan';

@Component({
  selector: 'app-launch-plan-detail',
  template: `
    <div *ngIf="loaded || error" class="detail-page">
      <div class="breadcrumb">
        <a (click)="router.navigate(['/'])">上线计划单列表</a>
        <span class="sep">/</span>
        <span *ngIf="plan">{{plan.plan_no}} · {{plan.project_name}}</span>
      </div>

      <div *ngIf="error" class="alert alert-error mb-md">
        ⚠️ {{error}}
        <button class="btn btn-sm ml-sm" (click)="loadDetail()" style="margin-left:12px">🔄 重试</button>
        <button class="btn btn-sm" (click)="router.navigate(['/'])">返回列表</button>
      </div>

      <ng-container *ngIf="plan">
        <div class="header-card card mb-md">
          <div class="flex flex-between wrap gap-md">
            <div>
              <div class="plan-info">
                <span class="plan-no">{{plan.plan_no}}</span>
                <span class="tag" [ngClass]="statusTagClass(plan.status)" style="font-size:14px;padding:4px 12px">
                  {{plan.status_name}}
                </span>
                <span *ngIf="plan.deadline_warning === 'urgent'" class="tag tag-warning ml-sm">⏰ 临期</span>
                <span *ngIf="plan.deadline_warning === 'overdue'" class="tag tag-urgent ml-sm">🚨 已逾期</span>
              </div>
              <div class="customer-info mt-sm">
                <span class="customer-name">{{plan.customer_name}}</span>
                <span class="sep">|</span>
                <span class="project-name">{{plan.project_name}}</span>
              </div>
            </div>
            <div class="action-buttons flex gap-sm wrap">
              <ng-container *ngIf="canEdit">
                <ng-container *ngIf="plan.status === 'draft'">
                  <button *ngIf="canAssign"
                    class="btn btn-primary"
                    [disabled]="loading || plan.accept_status === 'accepted'"
                    (click)="showAssignSelect = !showAssignSelect">
                    🔄 {{plan.accept_status === 'accepted' ? '已接办（不可重新指派）' : '指派交付顾问'}}
                  </button>
                  <button *ngIf="showAcceptButton"
                    class="btn btn-primary"
                    [disabled]="loading"
                    (click)="doAccept()">
                    ✋ 接办（{{plan.accept_status_name}}）
                  </button>
                  <button *ngIf="canSubmit"
                    class="btn btn-warning"
                    [disabled]="loading || submitDisabled"
                    [title]="submitDisabled ? submitDisabledReason : ''"
                    (click)="doSubmit()">
                    📤 提交复核{{submitDisabled ? '（未接办）' : ''}}
                  </button>
                </ng-container>
                <button *ngIf="plan.status === 'pending_review' && currentUser.role === 'cs_lead'"
                  class="btn btn-danger"
                  [disabled]="loading"
                  (click)="showRejectModal = true">
                  ↩️ 退回补正
                </button>
                <button *ngIf="plan.status === 'pending_review' && currentUser.role === 'cs_lead'"
                  class="btn btn-success"
                  [disabled]="loading"
                  (click)="showArchiveModal = true">
                  ✅ 归档收口
                </button>
                <button class="btn btn-primary" [disabled]="saving || loading" (click)="saveChanges()">
                  💾 {{saving ? '保存中...' : '保存修改'}}
                </button>
              </ng-container>
              <button *ngIf="!canEdit && plan.status !== 'archived'" class="btn" disabled style="opacity:.7" title="非当前处理人无法操作">
                🔒 当前处理人：{{plan.current_handler}}（{{plan.current_handler_role_name || '未知角色'}}）
              </button>
              <button *ngIf="plan.status === 'archived'" class="btn" disabled style="opacity:.7">
                📦 已归档（只读）
              </button>
              <button class="btn" (click)="router.navigate(['/'])">📋 返回列表</button>
            </div>
          </div>

          <div class="meta-row flex gap-md wrap mt-md">
            <div class="meta-item">
              <span class="meta-label">优先级</span>
              <span class="tag" [ngClass]="priorityTagClass(plan.priority)">{{plan.priority_name}}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">截止日期</span>
              <strong [ngClass]="{
                'danger': plan.deadline_warning === 'overdue',
                'warning': plan.deadline_warning === 'urgent'
              }">{{plan.deadline}}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">责任人</span>
              <strong>{{plan.owner}}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">当前处理人</span>
              <strong [ngClass]="{primary: plan.current_handler === currentUser.name}">
                {{plan.current_handler === currentUser.name ? '👉 ' : ''}}{{plan.current_handler}}
              </strong>
              <span *ngIf="plan.current_handler_role_name" class="tag tag-info" style="margin-left:4px;font-size:11px">
                {{plan.current_handler_role_name}}
              </span>
            </div>
            <div class="meta-item" *ngIf="plan.assignee">
              <span class="meta-label">指派交付顾问</span>
              <strong>{{plan.assignee}}</strong>
              <span *ngIf="plan.assignee_role" class="tag tag-info" style="margin-left:4px;font-size:11px">
                {{plan.assignee_role === 'delivery_consultant' ? '交付顾问' : plan.assignee_role}}
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">接办状态</span>
              <span class="tag" [ngClass]="acceptStatusTagClass(plan.accept_status)">
                {{plan.accept_status_name}}
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">创建人</span>
              <span>{{plan.created_by}}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">版本</span>
              <span style="font-family:monospace">v{{localVersion ?? plan.version}}</span>
              <span *ngIf="localVersion && localVersion !== plan.version"
                class="tag tag-danger ml-sm">页面 v{{localVersion}} ≠ 后端 v{{plan.version}}</span>
            </div>
          </div>

          <div *ngIf="showAssignSelect && canAssign && plan.accept_status !== 'accepted' && plan.status === 'draft'"
            class="assign-bar flex gap-sm mt-md" style="padding:12px;background:#f0f9ff;border:1px solid #93c5fd;border-radius:8px">
            <span style="font-size:14px;line-height:36px;color:#1d4ed8">
              🔄 {{plan.accept_status === 'assigned' ? '更换交付顾问：' : '选择交付顾问：'}}
            </span>
            <select class="select" [(ngModel)]="assigneeName" style="flex:0 0 180px">
              <option value="">-- 请选择 --</option>
              <option *ngFor="let u of deliveryConsultants" [value]="u.name">{{u.name}}（{{u.role_name}}）</option>
            </select>
            <input class="input" [(ngModel)]="assignComment" placeholder="指派说明（可选）" style="flex:1">
            <button class="btn btn-primary btn-sm" [disabled]="!assigneeName || assigning" (click)="doAssign()">
              {{assigning ? '指派中...' : (plan.accept_status === 'assigned' ? '确认更换' : '确认指派')}}
            </button>
            <button class="btn btn-sm" (click)="showAssignSelect = false">取消</button>
          </div>
        </div>

        <div *ngIf="plan.reject_reason" class="alert alert-warning mb-md">
          <strong>↩️ 被退回原因：</strong>{{plan.reject_reason}}
          <span class="ml-sm" style="font-size:12px;opacity:.8">
            请按原因补正后重新提交复核
          </span>
        </div>

        <div *ngIf="plan.accept_status !== 'accepted' && plan.status === 'draft'" class="alert mb-md"
             [ngClass]="{
               'alert-warning': plan.accept_status === 'unassigned',
               'alert-info': plan.accept_status === 'assigned' && !showAcceptButton,
               'alert-success': showAcceptButton
             }">
          <ng-container *ngIf="plan.accept_status === 'unassigned'">
            <strong>⚠️ 尚未指派交付顾问：</strong>该单据由客户成功经理{{plan.owner}}负责，当前接办状态为「未指派」。
            请先指派交付顾问，由交付顾问接办后才能提交待复核。
            <ng-container *ngIf="canAssign">
              <br>👉 点击上方「🔄 指派交付顾问」按钮选择交付顾问。
            </ng-container>
          </ng-container>
          <ng-container *ngIf="plan.accept_status === 'assigned' && showAcceptButton">
            <strong>✋ 等待您接办：</strong>该单据已由客户成功经理{{plan.owner}}指派给您，
            请先点击上方「✋ 接办」按钮，然后再办理材料并提交复核。
          </ng-container>
          <ng-container *ngIf="plan.accept_status === 'assigned' && !showAcceptButton">
            <strong>⏳ 等待交付顾问接办：</strong>该单据已指派给交付顾问{{plan.assignee}}（{{plan.accept_status_name}}），
            暂不能提交待复核，请先完成接办。
          </ng-container>
        </div>

        <div *ngIf="plan.deadline_warning === 'overdue'" class="alert alert-error mb-md">
          <strong>🚨 该单据已逾期（截止日期 {{plan.deadline}}）！</strong>
          责任人：{{plan.owner}}。逾期单据无法通过批量推进，请在本页补正后手动提交。
        </div>

        <div class="main-grid">
          <div class="col-main">
            <div class="card mb-md">
              <div class="section-title">🎯 上线目标</div>
              <textarea *ngIf="canEdit && plan.status !== 'archived'"
                class="textarea" rows="4"
                [(ngModel)]="form.launch_target"
                placeholder="请详细描述本次上线要达成的目标..."></textarea>
              <div *ngIf="!canEdit || plan.status === 'archived'"
                class="readonly-content">{{form.launch_target || '（未填写）'}}</div>
            </div>

            <div class="card mb-md">
              <div class="section-title">✔️ 配置检查清单</div>
              <textarea *ngIf="canEdit && plan.status !== 'archived'"
                class="textarea" rows="6"
                [(ngModel)]="form.config_checklist"
                placeholder="请逐项列出配置检查内容，例如：&#10;1. 数据库配置&#10;2. 用户权限配置&#10;3. 第三方集成配置..."></textarea>
              <div *ngIf="!canEdit || plan.status === 'archived'"
                class="readonly-content" [style.white-space]="'pre-wrap'">{{form.config_checklist || '（未填写）'}}</div>
            </div>

            <div class="card mb-md">
              <div class="section-title">✅ 验收确认</div>
              <textarea *ngIf="(canEdit || plan.status === 'pending_review') && plan.status !== 'archived'"
                class="textarea" rows="4"
                [(ngModel)]="form.acceptance_notes"
                placeholder="归档前请填写客户方验收确认信息，例如：客户方IT总监张某某于2026-06-01签字确认UAT通过..."></textarea>
              <div *ngIf="(!canEdit && plan.status !== 'pending_review') || plan.status === 'archived'"
                class="readonly-content" [style.white-space]="'pre-wrap'">{{form.acceptance_notes || '（未填写）'}}</div>
            </div>

            <div class="card mb-md">
              <div class="section-title">📎 附件</div>
              <div *ngIf="canEdit && plan.status !== 'archived'" class="upload-area mb-sm">
                <input type="file" id="fileInput" multiple hidden #fileInput (change)="onFileSelected($event)" />
                <button class="btn btn-primary" for="fileInput" (click)="fileInput.click()">
                  📤 上传附件
                </button>
                <span style="font-size:12px;color:var(--text-secondary);margin-left:8px">
                  支持多文件上传，单个≤50MB
                </span>
              </div>
              <div *ngIf="attachments.length === 0" class="empty-tip">
                {{canEdit && plan.status !== 'archived' ? '暂无附件，请先上传' : '暂无附件'}}
              </div>
              <table *ngIf="attachments.length > 0" class="mini-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th style="width:100px">大小</th>
                    <th style="width:140px">上传人</th>
                    <th style="width:180px">上传时间</th>
                    <th *ngIf="canEdit && plan.status !== 'archived'" style="width:80px">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let a of attachments">
                    <td>📄 {{a.file_name}}</td>
                    <td>{{formatSize(a.file_size)}}</td>
                    <td>{{a.uploaded_by}}</td>
                    <td>{{a.uploaded_at}}</td>
                    <td *ngIf="canEdit && plan.status !== 'archived'">
                      <button *ngIf="a.uploaded_by === currentUser.name || currentUser.role === 'cs_lead'"
                        class="btn btn-sm btn-danger" (click)="deleteAttachment(a)">
                        删除
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="col-side">
            <div class="card mb-md">
              <div class="section-title">📋 处理结果</div>
              <div *ngIf="plan.status === 'archived'"
                class="readonly-content" style="background:#f0f9eb;border:1px solid #c2e7b0;padding:12px;border-radius:6px;color:#15803d">
                ✅ {{plan.result}}
              </div>
              <ng-container *ngIf="plan.status !== 'archived'">
                <textarea *ngIf="(canEdit || plan.status === 'pending_review')"
                  class="textarea" rows="4"
                  [(ngModel)]="form.result"
                  placeholder="归档时请填写处理结果，例如：上线成功，系统稳定运行，客户满意..."></textarea>
                <div *ngIf="!canEdit && plan.status !== 'pending_review'"
                  class="readonly-content">{{form.result || '（待归档时填写）'}}</div>
                <div *ngIf="plan.status === 'pending_review' && currentUser.role !== 'cs_lead'" class="mt-sm alert alert-info">
                  💡 结果由客户成功负责人在归档时最终确认
                </div>
              </ng-container>
            </div>

            <div class="card mb-md">
              <div class="section-title">↩️ 退回原因</div>
              <div *ngIf="plan.status === 'pending_review' && currentUser.role === 'cs_lead'">
                <textarea class="textarea" rows="4"
                  [(ngModel)]="form.reject_reason"
                  placeholder="如需退回，请在此说明原因，然后点击上方「退回补正」按钮..."></textarea>
              </div>
              <div *ngIf="plan.reject_reason"
                class="readonly-content" style="background:#fef2f2;border:1px solid #fbc4c4;padding:12px;border-radius:6px;color:#b91c1c">
                {{plan.reject_reason}}
              </div>
              <div *ngIf="!plan.reject_reason && !(plan.status === 'pending_review' && currentUser.role === 'cs_lead')"
                class="empty-tip">暂无退回记录</div>
            </div>

            <div class="card mb-md">
              <div class="section-title">📝 添加审计备注</div>
              <div class="flex gap-sm mb-sm">
                <textarea class="textarea" rows="3" [(ngModel)]="newAuditNote"
                  placeholder="任何角色均可追加审计备注，备注将永久记录不可删除..."></textarea>
              </div>
              <button class="btn btn-sm" [disabled]="!newAuditNote.trim() || loadingNote" (click)="addAuditNote()">
                {{loadingNote ? '添加中...' : '追加备注'}}
              </button>
            </div>

            <div class="card mb-md">
              <div class="section-title">👁️ 单据信息</div>
              <div class="info-list">
                <div class="info-row"><span>创建时间</span><span>{{plan.created_at}}</span></div>
                <div class="info-row"><span>更新时间</span><span>{{plan.updated_at}}</span></div>
                <div class="info-row"><span>附件数量</span><span>{{attachments.length}} 个</span></div>
                <div class="info-row"><span>处理记录</span><span>{{processRecords.length}} 条</span></div>
                <div class="info-row"><span>审计备注</span><span>{{auditNotes.length}} 条</span></div>
                <div class="info-row"><span>异常日志</span><span>{{exceptionLogs.length}} 条</span></div>
              </div>
            </div>

            <div *ngIf="formSubmitComment != null && plan.status === 'draft'" class="card mb-md">
              <div class="section-title">📤 提交复核说明</div>
              <div class="form-item" style="margin:0">
                <label class="form-label">提交备注（可选）</label>
                <textarea class="textarea" rows="2"
                  [(ngModel)]="submitComment"
                  placeholder="提交时的简要说明，例如：配置完成，客户已验收..."></textarea>
              </div>
              <div class="form-item mt-sm" style="margin:0">
                <label class="form-label">证据说明（如未上传附件则必填）</label>
                <input class="input" [(ngModel)]="submitEvidence"
                  placeholder="例如：配置截图3张、UAT测试报告...">
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-md">
          <div class="section-title">🔄 审计轨迹</div>
          <app-audit-timeline
            [processRecords]="processRecords"
            [auditNotes]="auditNotes"
            [exceptionLogs]="exceptionLogs">
          </app-audit-timeline>
        </div>
      </ng-container>
    </div>

    <div *ngIf="!loaded && !error" class="loading flex-center p-lg">
      <div style="text-align:center;color:var(--text-secondary)">
        <div style="font-size:40px">⏳</div>
        <div class="mt-sm">加载中...</div>
      </div>
    </div>

    <app-reject-modal *ngIf="showRejectModal"
      [planNo]="plan?.plan_no || ''"
      (close)="onRejectClose($event)">
    </app-reject-modal>

    <app-archive-modal *ngIf="showArchiveModal"
      [planNo]="plan?.plan_no || ''"
      (close)="onArchiveClose($event)">
    </app-archive-modal>
  `,
  styles: [`
    .plan-no {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary);
      background: var(--bg-hover);
      padding: 4px 12px;
      border-radius: 4px;
      margin-right: 10px;
    }
    .customer-name { font-size: 16px; font-weight: 600; }
    .project-name { color: var(--text-regular); }
    .sep { margin: 0 8px; color: var(--border); }
    .meta-row { padding-top: 12px; border-top: 1px dashed var(--border); }
    .meta-item { display: flex; align-items: center; gap: 8px; }
    .meta-label { color: var(--text-secondary); font-size: 12px; }
    .danger { color: var(--danger); }
    .warning { color: var(--warning); }
    .primary { color: var(--primary); font-weight: 700; }

    .main-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 16px;
    }
    @media (max-width: 1100px) {
      .main-grid { grid-template-columns: 1fr; }
    }

    .readonly-content {
      padding: 12px;
      background: var(--bg-light);
      border-radius: 6px;
      line-height: 1.7;
      color: var(--text-regular);
      border: 1px solid transparent;
    }

    .info-list .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed var(--border);
      font-size: 13px;
    }
    .info-list .info-row:last-child { border: none; }
    .info-list .info-row span:first-child { color: var(--text-secondary); }
    .info-list .info-row span:last-child { font-weight: 500; }

    .empty-tip {
      padding: 16px;
      text-align: center;
      color: var(--text-secondary);
      background: var(--bg-light);
      border-radius: 4px;
      font-size: 13px;
    }

    .mini-table th, .mini-table td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .mini-table th { background: var(--bg-light); color: var(--text-regular); }

    .loading { min-height: 60vh; }
  `],
})
export class LaunchPlanDetailComponent implements OnInit, OnDestroy {
  plan: LaunchPlan | null = null;
  attachments: Attachment[] = [];
  processRecords: ProcessRecord[] = [];
  auditNotes: AuditNote[] = [];
  exceptionLogs: ExceptionLog[] = [];

  form: any = {};
  loaded = false;
  error = '';
  loading = false;
  saving = false;
  loadingNote = false;
  localVersion: number | null = null;
  newAuditNote = '';

  showRejectModal = false;
  showArchiveModal = false;
  showAssignSelect = false;
  assigneeName = '';
  assignComment = '';
  assigning = false;

  formSubmitComment = true;
  submitComment = '';
  submitEvidence = '';

  private subs = new Subscription();
  private planId!: string;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private svc: LaunchPlanService,
    public auth: AuthService,
    private toast: ToastService,
  ) {}

  get currentUser() { return this.auth.currentUser; }

  get canEdit(): boolean {
    if (!this.plan) return false;
    if (this.plan.status === 'archived') return false;
    const u = this.currentUser;
    if (u.role === 'cs_lead') return true;
    if (u.name === this.plan.current_handler) return true;
    if (u.role === 'cs_manager' && this.plan.owner === u.name) return true;
    return false;
  }

  get canSubmit(): boolean {
    if (!this.plan) return false;
    const u = this.currentUser;
    if (this.plan.status !== 'draft') return false;
    if (u.role === 'cs_lead') return true;
    if (u.role === 'delivery_consultant' && this.plan.accept_status === 'accepted' && this.plan.assignee === u.name) return true;
    return false;
  }

  get canAssign(): boolean {
    if (!this.plan) return false;
    const u = this.currentUser;
    return u.role === 'cs_manager' && this.plan.owner === u.name && this.plan.status === 'draft';
  }

  get deliveryConsultants(): User[] {
    return this.auth.getAllUsers().filter(u => u.role === 'delivery_consultant');
  }

  get showAcceptButton(): boolean {
    if (!this.plan) return false;
    const u = this.currentUser;
    return this.plan.status === 'draft'
      && this.plan.accept_status === 'assigned'
      && this.plan.assignee === u.name
      && u.role === 'delivery_consultant';
  }

  get submitDisabled(): boolean {
    if (!this.plan) return false;
    return this.plan.accept_status !== 'accepted';
  }

  get submitDisabledReason(): string {
    if (!this.plan) return '';
    if (this.plan.accept_status === 'unassigned') {
      return '该单据尚未指派交付顾问，请先指派并由交付顾问接办后再提交';
    }
    if (this.plan.accept_status === 'assigned') {
      return `该单据已指派给${this.plan.assignee}但尚未接办，请先完成接办后再提交`;
    }
    return '';
  }

  acceptStatusTagClass(s: string): string {
    switch (s) {
      case 'unassigned': return 'tag-gray';
      case 'assigned': return 'tag-warning';
      case 'accepted': return 'tag-success';
      default: return 'tag-gray';
    }
  }

  ngOnInit() {
    this.planId = this.route.snapshot.params['id'];
    this.loadDetail();
    this.subs.add(this.auth.user$.subscribe(() => {
      if (this.loaded) this.loadDetail();
    }));
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  loadDetail() {
    this.loading = true;
    this.error = '';
    this.svc.getDetail(this.planId).subscribe(
      (res) => {
        this.plan = res.plan;
        this.attachments = res.attachments;
        this.processRecords = res.process_records;
        this.auditNotes = res.audit_notes;
        this.exceptionLogs = res.exception_logs;
        this.form = {
          customer_name: this.plan.customer_name,
          project_name: this.plan.project_name,
          priority: this.plan.priority,
          deadline: this.plan.deadline,
          launch_target: this.plan.launch_target,
          config_checklist: this.plan.config_checklist,
          acceptance_notes: this.plan.acceptance_notes,
          result: this.plan.result,
          reject_reason: this.plan.reject_reason,
        };
        this.localVersion = this.plan.version;
        this.loaded = true;
        this.loading = false;
      },
      (e) => {
        this.error = '加载详情失败：' + (e.error?.error || e.message || '未知错误');
        this.loaded = true;
        this.loading = false;
      }
    );
  }

  formChanged(): boolean {
    if (!this.plan) return false;
    return Object.keys(this.form).some(k => this.form[k] !== (this.plan as any)[k]);
  }

  saveChanges() {
    if (!this.plan || !this.formChanged()) {
      this.toast.info('暂无修改内容');
      return;
    }
    if (this.localVersion !== this.plan.version) {
      if (!confirm(`⚠️ 检测到后端版本已更新：页面 v${this.localVersion}，后端 v${this.plan.version}。\n继续保存将覆盖，请确认是否继续？`)) {
        this.toast.warning('已取消保存，请刷新后再试');
        return;
      }
    }
    this.saving = true;
    this.svc.update(this.plan.id, { ...this.form, version: this.localVersion }).subscribe(
      (res) => {
        this.localVersion = res.new_version;
        this.toast.success(res.message || '保存成功');
        this.saving = false;
        this.loadDetail();
      },
      (e) => {
        this.saving = false;
        const msg = e.error?.error || '保存失败，请重试';
        if (e.status === 409) {
          this.toast.error(msg + '（请刷新后重试）');
          if (e.error?.current_version) this.localVersion = e.error.current_version;
        } else if (e.status === 403) {
          this.toast.error(msg);
        } else {
          this.toast.error(msg);
        }
      }
    );
  }

  doAssign() {
    if (!this.plan || !this.assigneeName) return;
    this.assigning = true;
    this.svc.assign(this.plan.id, this.assigneeName, this.localVersion!, this.assignComment.trim()).subscribe(
      (res) => {
        this.localVersion = res.new_version;
        this.toast.success(`已指派给交付顾问 ${this.assigneeName}`);
        this.assigneeName = '';
        this.assignComment = '';
        this.showAssignSelect = false;
        this.assigning = false;
        this.loadDetail();
      },
      (e) => {
        this.assigning = false;
        const msg = e.error?.error || '指派失败';
        if (e.status === 409) {
          this.toast.error('版本冲突：' + msg + '（请刷新后重试）');
        } else {
          this.toast.error(msg);
        }
      }
    );
  }

  doAccept() {
    if (!this.plan) return;
    this.loading = true;
    this.svc.accept(this.plan.id, this.localVersion!).subscribe(
      (res) => {
        this.localVersion = res.new_version;
        this.toast.success('已接办该计划单');
        this.loading = false;
        this.loadDetail();
      },
      (e) => {
        this.loading = false;
        const msg = e.error?.error || '接办失败';
        if (e.status === 409) {
          this.toast.error('版本冲突：' + msg + '（请刷新后重试）');
        } else {
          this.toast.error(msg);
        }
      }
    );
  }

  doSubmit() {
    if (!this.plan) return;
    if (this.formChanged()) {
      if (!confirm('您有未保存的修改，是否先保存再提交？\n点击「确定」先保存修改再提交，「取消」直接提交。')) {
        // 继续提交
      } else {
        this.saveChanges();
        setTimeout(() => this.doSubmitActual(), 1500);
        return;
      }
    }
    this.doSubmitActual();
  }

  doSubmitActual() {
    if (!this.plan) return;
    if (this.plan!.deadline_warning === 'overdue') {
      if (!confirm('⚠️ 该单据已逾期！确认提交复核？逾期单据会留下异常日志。')) {
        return;
      }
    }
    this.loading = true;
    this.svc.submit(
      this.plan!.id,
      this.localVersion!,
      this.submitComment.trim(),
      this.submitEvidence.trim()
    ).subscribe(
      (res) => {
        this.localVersion = res.new_version;
        this.toast.success(res.message || '已提交复核');
        this.submitComment = '';
        this.submitEvidence = '';
        this.loading = false;
        this.loadDetail();
      },
      (e) => {
        this.loading = false;
        const msg = e.error?.error || '提交失败';
        if (e.status === 409) {
          this.toast.error('版本冲突：' + msg);
        } else if (e.status === 400) {
          this.toast.warning(msg);
        } else {
          this.toast.error(msg);
        }
      }
    );
  }

  onRejectClose(data: any) {
    if (!data) { this.showRejectModal = false; return; }
    this.loading = true;
    this.svc.reject(this.plan!.id, this.localVersion!, data.reject_reason, data.comment).subscribe(
      (res) => {
        this.localVersion = res.new_version;
        this.toast.success(res.message || '已退回补正');
        this.showRejectModal = false;
        this.loading = false;
        this.loadDetail();
      },
      (e) => {
        this.loading = false;
        this.toast.error(e.error?.error || '退回失败');
      }
    );
  }

  onArchiveClose(data: any) {
    if (!data) { this.showArchiveModal = false; return; }
    if (this.formChanged()) {
      if (!confirm('您有未保存的内容，归档时会以表单内容为准，确认继续归档吗？')) {
        return;
      }
    }
    if (data.result) {
      this.form.result = data.result;
    }
    if (this.formChanged()) {
      // 先保存结果再归档
      this.svc.update(this.plan!.id, { result: this.form.result, acceptance_notes: this.form.acceptance_notes, version: this.localVersion }).subscribe(
        (r1) => {
          this.localVersion = r1.new_version;
          this.doArchive(data);
        },
        (e) => this.toast.error('保存结果失败：' + (e.error?.error || e.message))
      );
    } else {
      this.doArchive(data);
    }
  }

  doArchive(data: any) {
    this.loading = true;
    this.svc.archive(this.plan!.id, this.localVersion!, data.result, data.audit_note, data.evidence).subscribe(
      (res) => {
        this.localVersion = res.new_version;
        this.toast.success('🎉 ' + (res.message || '归档成功，闭环完成'));
        this.showArchiveModal = false;
        this.loading = false;
        this.loadDetail();
      },
      (e) => {
        this.loading = false;
        const msg = e.error?.error || '归档失败';
        if (e.status === 400) this.toast.warning(msg);
        else this.toast.error(msg);
      }
    );
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.loading = true;
    this.svc.uploadAttachment(this.plan!.id, input.files).subscribe(
      (res) => {
        this.toast.success(`上传成功 ${res.uploaded} 个文件`);
        input.value = '';
        this.loading = false;
        this.loadDetail();
      },
      (e) => {
        this.loading = false;
        this.toast.error('上传失败：' + (e.error?.error || e.message));
      }
    );
  }

  deleteAttachment(a: Attachment) {
    if (!confirm(`确认删除附件「${a.file_name}」？`)) return;
    this.svc.deleteAttachment(a.id).subscribe(
      () => {
        this.toast.success('已删除');
        this.loadDetail();
      },
      (e) => this.toast.error('删除失败：' + (e.error?.error || e.message))
    );
  }

  addAuditNote() {
    if (!this.newAuditNote.trim()) return;
    this.loadingNote = true;
    this.svc.addAuditNote(this.plan!.id, this.newAuditNote.trim()).subscribe(
      () => {
        this.newAuditNote = '';
        this.loadingNote = false;
        this.toast.success('已追加审计备注');
        this.loadDetail();
      },
      (e) => {
        this.loadingNote = false;
        this.toast.error('追加失败：' + (e.error?.error || e.message));
      }
    );
  }

  formatSize(b: number) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  }

  statusTagClass(s: string) {
    switch (s) {
      case 'draft': return 'tag-info';
      case 'pending_review': return 'tag-warning';
      case 'archived': return 'tag-success';
      default: return 'tag-info';
    }
  }
  priorityTagClass(p: string) {
    switch (p) {
      case 'urgent': return 'tag-urgent';
      case 'high': return 'tag-warning';
      case 'medium': return 'tag-primary';
      case 'low': return 'tag-info';
      default: return 'tag-info';
    }
  }
}
