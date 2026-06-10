import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import {
  WorkOrderDetail, WorkOrderProcessRequest, User,
  STATUS_LABELS, WARNING_LABELS, WARNING_COLORS,
  EVIDENCE_TYPES
} from '../../models/models';

@Component({
  selector: 'app-workorder-detail',
  template: `
    <div *ngIf="order">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:15px">
          <button (click)="goBack()"
            style="padding:8px 16px;background:#fff;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer">
            ← 返回
          </button>
          <h3 style="margin:0">{{order.order_no}}</h3>
          <span [style.background]="getStatusBg(order.status)" [style.color]="getStatusColor(order.status)"
            style="padding:6px 16px;border-radius:16px;font-size:13px">
            {{STATUS_LABELS[order.status]}}
          </span>
          <span [style.color]="WARNING_COLORS[order.warning_level]" style="font-weight:bold">
            {{WARNING_LABELS[order.warning_level]}}
            <span *ngIf="order.is_overdue" style="color:#ff4d4f">(已逾期)</span>
          </span>
        </div>
        <div style="color:#888;font-size:13px">
          版本号: v{{order.version}} | 创建时间: {{formatDateTime(order.created_at)}}
        </div>
      </div>

      <div *ngIf="order.exception_reason" style="background:#fff2f0;border:1px solid #ffccc7;padding:15px 20px;border-radius:8px;margin-bottom:20px">
        <div style="color:#ff4d4f;font-weight:bold;margin-bottom:5px">⚠️ 异常原因</div>
        <div style="color:#666">{{order.exception_reason}}</div>
      </div>

      <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
        <div>
          <div style="background:#fff;padding:24px;border-radius:8px;margin-bottom:20px">
            <h4 style="margin:0 0 20px 0;padding-bottom:10px;border-bottom:1px solid #f0f0f0">基本信息</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px 30px">
              <div>
                <span style="color:#888;font-size:13px">预约进厂线索</span>
                <div style="font-weight:500;margin-top:4px">{{order.appointment_clue}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">客户姓名</span>
                <div style="font-weight:500;margin-top:4px">{{order.customer_name}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">联系电话</span>
                <div style="font-weight:500;margin-top:4px">{{order.phone}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">车牌号</span>
                <div style="font-weight:500;margin-top:4px">{{order.license_plate}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">车型</span>
                <div style="font-weight:500;margin-top:4px">{{order.car_model}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">里程数</span>
                <div style="font-weight:500;margin-top:4px">{{order.mileage}} km</div>
              </div>
              <div style="grid-column:span 2">
                <span style="color:#888;font-size:13px">故障描述</span>
                <div style="font-weight:500;margin-top:4px">{{order.fault_description}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">预计完成时间</span>
                <div style="font-weight:500;margin-top:4px">{{formatDateTime(order.expected_complete_at)}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">登记员</span>
                <div style="font-weight:500;margin-top:4px">{{order.registrar_name}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">当前处理人</span>
                <div style="font-weight:500;margin-top:4px">{{order.current_handler_name}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">审核主管</span>
                <div style="font-weight:500;margin-top:4px">{{order.supervisor_name || '-'}}</div>
              </div>
              <div>
                <span style="color:#888;font-size:13px">复核负责人</span>
                <div style="font-weight:500;margin-top:4px">{{order.manager_name || '-'}}</div>
              </div>
            </div>
          </div>

          <div style="background:#fff;padding:24px;border-radius:8px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #f0f0f0">
              <h4 style="margin:0">证据附件 ({{order.attachments.length}})</h4>
              <button (click)="showUploadForm = !showUploadForm"
                style="padding:6px 16px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">
                {{showUploadForm ? '收起上传' : '📤 上传附件'}}
              </button>
            </div>

            <div *ngIf="showUploadForm" style="background:#f0f5ff;padding:20px;border-radius:8px;margin-bottom:20px;border:1px solid #d6e4ff">
              <div style="font-size:14px;font-weight:bold;color:#1890ff;margin-bottom:15px">上传证据附件</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div>
                  <label style="display:block;margin-bottom:6px;color:#333;font-size:13px">证据类型 <span style="color:#ff4d4f">*</span></label>
                  <select [(ngModel)]="uploadEvidenceType"
                    style="width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:4px">
                    <option value="">请选择证据类型</option>
                    <option *ngFor="let ev of EVIDENCE_TYPES" [value]="ev.value">{{ev.label}}</option>
                  </select>
                </div>
                <div>
                  <label style="display:block;margin-bottom:6px;color:#333;font-size:13px">选择文件 <span style="color:#ff4d4f">*</span></label>
                  <input type="file" (change)="onFileSelected($event)"
                    style="width:100%;padding:6px;border:1px solid #d9d9d9;border-radius:4px;font-size:13px">
                </div>
              </div>
              <div *ngIf="selectedFile" style="margin-top:8px;font-size:12px;color:#666">
                已选择: {{selectedFile.name}} ({{formatFileSize(selectedFile.size)}})
              </div>
              <div *ngIf="uploadError" style="margin-top:8px;color:#ff4d4f;font-size:12px">{{uploadError}}</div>
              <div *ngIf="uploadSuccess" style="margin-top:8px;color:#52c41a;font-size:12px">{{uploadSuccess}}</div>
              <div style="margin-top:12px;text-align:right">
                <button (click)="uploadFile()" [disabled]="!uploadEvidenceType || !selectedFile || uploading"
                  style="padding:8px 20px;background:#52c41a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">
                  {{uploading ? '上传中...' : '确认上传'}}
                </button>
              </div>
            </div>

            <div *ngIf="order.attachments.length === 0" style="color:#999;text-align:center;padding:30px">
              暂无附件
            </div>
            <div *ngFor="let att of order.attachments" style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#fafafa;border-radius:6px;margin-bottom:8px">
              <div style="display:flex;align-items:center;gap:12px">
                <span style="font-size:20px">📄</span>
                <div>
                  <div style="font-weight:500">{{att.file_name}}</div>
                  <div style="font-size:12px;color:#888">
                    {{getEvidenceLabel(att.evidence_type)}} | 上传于 {{formatDateTime(att.created_at)}} by {{att.uploader}}
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:12px;color:#888">{{formatFileSize(att.file_size)}}</span>
                <a [href]="getDownloadUrl(att.id)" target="_blank"
                  style="padding:4px 10px;background:#e6f7ff;color:#1890ff;border:none;border-radius:4px;cursor:pointer;font-size:12px;text-decoration:none">
                  下载
                </a>
              </div>
            </div>

            <div *ngIf="requiredEvidence.length > 0" style="margin-top:15px;padding:15px;border-radius:6px"
              [style.background]="allEvidenceFulfilled ? '#f6ffed' : '#fffbe6'"
              [style.border]="allEvidenceFulfilled ? '1px solid #b7eb8f' : '1px solid #ffe58f'">
              <div style="font-size:13px;font-weight:bold;margin-bottom:8px"
                [style.color]="allEvidenceFulfilled ? '#389e0d' : '#d48806'">
                {{allEvidenceFulfilled ? '✅ 必填证据已齐全' : '📋 必填证据清单（当前步骤推进所需）'}}
              </div>
              <div style="font-size:12px;color:#888;line-height:2.2">
                <span *ngFor="let ev of requiredEvidence" style="margin-right:15px;display:inline-block">
                  <span [style.color]="hasEvidence(ev.value) ? '#52c41a' : '#ff4d4f'">
                    {{hasEvidence(ev.value) ? '✅' : '❌'}} {{ev.label}}
                  </span>
                  <button *ngIf="!hasEvidence(ev.value)" (click)="quickUpload(ev.value)"
                    style="margin-left:4px;padding:2px 8px;background:#ff4d4f;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px">
                    上传
                  </button>
                </span>
              </div>
              <div *ngIf="!allEvidenceFulfilled && canProcess" style="margin-top:10px;font-size:12px;color:#ff4d4f">
                ⚠️ 缺少必填证据，无法推进到下一环节。请先上传缺失的证据附件。
              </div>
            </div>
          </div>

          <div style="background:#fff;padding:24px;border-radius:8px">
            <h4 style="margin:0 0 20px 0;padding-bottom:10px;border-bottom:1px solid #f0f0f0">
              处理记录 ({{order.processing_logs.length}})
            </h4>
            <div *ngIf="order.processing_logs.length === 0" style="color:#999;text-align:center;padding:30px;font-size:13px">
              暂无处理记录
            </div>
            <div *ngFor="let log of order.processing_logs" style="display:flex;gap:15px;padding:15px 0;border-bottom:1px dashed #f0f0f0">
              <div style="width:40px;height:40px;border-radius:50%;background:#e6f7ff;color:#1890ff;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0">
                {{log.operator.charAt(0)}}
              </div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-weight:500">{{log.operator}}</span>
                  <span style="font-size:12px;color:#888">{{formatDateTime(log.created_at)}}</span>
                </div>
                <div style="margin:5px 0;color:#1890ff;font-size:14px">{{log.action}}</div>
                <div style="font-size:13px;color:#666">
                  <span *ngIf="log.from_status">{{STATUS_LABELS[log.from_status]}} → </span>
                  <span>{{STATUS_LABELS[log.to_status]}}</span>
                </div>
                <div *ngIf="log.remark" style="margin-top:5px;padding:8px 12px;background:#f5f5f5;border-radius:4px;font-size:13px;color:#666">
                  {{log.remark}}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div *ngIf="canProcess" style="background:#fff;padding:24px;border-radius:8px;margin-bottom:20px">
            <h4 style="margin:0 0 20px 0;padding-bottom:10px;border-bottom:1px solid #f0f0f0">办理操作</h4>
            <div style="margin-bottom:12px;padding:10px;background:#f0f5ff;border-radius:6px;font-size:12px;color:#1890ff">
              当前环节: <b>{{STATUS_LABELS[order.status]}}</b> | 您的角色: <b>{{ROLE_LABELS[currentUser!.role]}}</b>
            </div>

            <div *ngIf="error" style="color:#ff4d4f;margin-bottom:15px;padding:10px;background:#fff2f0;border-radius:4px;font-size:13px">
              {{error}}
            </div>

            <div *ngIf="!allEvidenceFulfilled && availableActions.length > 0" style="color:#fa8c16;margin-bottom:15px;padding:10px;background:#fff7e6;border:1px solid #ffe58f;border-radius:4px;font-size:13px">
              ⚠️ 必填证据尚未齐全，推进类操作将被后端拦截。建议先上传缺失证据。
            </div>

            <div style="margin-bottom:15px">
              <label style="display:block;margin-bottom:8px;color:#333;font-size:14px">处理备注</label>
              <textarea [(ngModel)]="processForm.remark" rows="3" placeholder="请输入处理备注（可选）"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px;resize:vertical"></textarea>
            </div>

            <div *ngIf="needExceptionReason" style="margin-bottom:15px">
              <label style="display:block;margin-bottom:8px;color:#333;font-size:14px">
                异常/退回原因 <span style="color:#ff4d4f">*</span>
                <span style="color:#999;font-weight:normal;font-size:12px;margin-left:8px">执行退回补正前请填写</span>
              </label>
              <textarea [(ngModel)]="processForm.exception_reason" rows="3" placeholder="请输入异常/退回原因（执行退回操作时必填）"
                [style.border]="exceptionReasonRequired ? '2px solid #ff4d4f' : '1px solid #d9d9d9'"
                style="width:100%;padding:10px;border-radius:4px;resize:vertical"></textarea>
              <div *ngIf="exceptionReasonRequired" style="margin-top:5px;color:#ff4d4f;font-size:12px">
                ⚠️ 请先填写退回原因后再执行退回操作
              </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:10px">
              <button *ngFor="let action of availableActions" (click)="executeAction(action.value, action.needReason)"
                [disabled]="loading || (action.evidenceRequired && !allEvidenceFulfilled)"
                [style.background]="getActionButtonStyle(action)"
                style="padding:12px;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;opacity:1"
                [style.opacity]="(action.evidenceRequired && !allEvidenceFulfilled) ? '0.5' : '1'">
                {{loading ? '处理中...' : action.label}}
                <span *ngIf="action.evidenceRequired && !allEvidenceFulfilled" style="font-size:11px;margin-left:5px">(证据不足)</span>
              </button>
            </div>
          </div>

          <div *ngIf="!canProcess && order.status !== 'completed' && order.status !== 'rejected'" style="background:#fff;padding:24px;border-radius:8px;margin-bottom:20px">
            <div style="text-align:center;color:#999;padding:20px">
              <div style="font-size:32px;margin-bottom:10px">🔒</div>
              <div>当前工单处理人为 <b>{{order.current_handler_name}}</b></div>
              <div style="font-size:13px;margin-top:5px">您无权操作此工单</div>
            </div>
          </div>

          <div *ngIf="order.status === 'completed'" style="background:#f6ffed;padding:24px;border-radius:8px;margin-bottom:20px;border:1px solid #b7eb8f">
            <div style="text-align:center;color:#52c41a">
              <div style="font-size:32px;margin-bottom:10px">✅</div>
              <div style="font-weight:bold;font-size:16px">工单已办结归档</div>
            </div>
          </div>

          <div style="background:#fff;padding:24px;border-radius:8px;margin-bottom:20px">
            <h4 style="margin:0 0 20px 0;padding-bottom:10px;border-bottom:1px solid #f0f0f0">
              审计备注 ({{order.audit_notes.length}})
            </h4>
            <div style="margin-bottom:15px">
              <textarea [(ngModel)]="newAuditNote" rows="2" placeholder="添加审计备注..."
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px;resize:vertical;margin-bottom:10px"></textarea>
              <button (click)="addAuditNote()" [disabled]="!newAuditNote.trim()"
                style="padding:6px 16px;background:#52c41a;color:#fff;border:none;border-radius:4px;cursor:pointer">
                添加备注
              </button>
            </div>
            <div *ngIf="order.audit_notes.length === 0" style="color:#999;text-align:center;padding:20px;font-size:13px">
              暂无审计备注
            </div>
            <div *ngFor="let note of order.audit_notes" style="padding:10px 0;border-bottom:1px dashed #f0f0f0">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#888;margin-bottom:5px">
                <span>{{note.operator}}</span>
                <span>{{formatDateTime(note.created_at)}}</span>
              </div>
              <div style="font-size:13px;color:#333">{{note.note}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="!order && !loading" style="text-align:center;padding:60px;color:#999">
      工单不存在或无权限查看
    </div>
    <div *ngIf="loading" style="text-align:center;padding:60px;color:#999">
      加载中...
    </div>
  `
})
export class WorkorderDetailComponent implements OnInit {
  order: WorkOrderDetail | null = null;
  loading = false;
  error = '';
  newAuditNote = '';
  showUploadForm = false;
  uploadEvidenceType = '';
  selectedFile: File | null = null;
  uploading = false;
  uploadError = '';
  uploadSuccess = '';

  processForm: WorkOrderProcessRequest = {
    action: '',
    remark: '',
    exception_reason: '',
    version: 0
  };
  exceptionReasonRequired = false;

  STATUS_LABELS = STATUS_LABELS;
  WARNING_LABELS = WARNING_LABELS;
  WARNING_COLORS = WARNING_COLORS;
  EVIDENCE_TYPES = EVIDENCE_TYPES;
  ROLE_LABELS: Record<string, string> = {
    registrar: '维修登记员',
    supervisor: '维修审核主管',
    manager: '复核负责人'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadDetail(id);
  }

  get currentUser(): User | null {
    return this.authService.currentUser;
  }

  get canProcess(): boolean {
    if (!this.order || !this.currentUser) return false;
    return this.order.current_handler_id === this.currentUser.id &&
           this.order.status !== 'completed' &&
           this.order.status !== 'rejected';
  }

  get needExceptionReason(): boolean {
    return this.availableActions.some(a => a.needReason);
  }

  get availableActions(): { value: string; label: string; danger?: boolean; evidenceRequired?: boolean; needReason?: boolean }[] {
    if (!this.order || !this.currentUser) return [];
    const actions: { value: string; label: string; danger?: boolean; evidenceRequired?: boolean; needReason?: boolean }[] = [];
    const status = this.order.status;
    const role = this.currentUser.role;

    if (status === 'draft' && role === 'registrar') {
      actions.push({ value: 'submit', label: '提交审核', evidenceRequired: true });
    }
    if (status === 'pending_audit' && role === 'supervisor') {
      actions.push({ value: 'approve', label: '审核通过，提交复核', evidenceRequired: true });
      actions.push({ value: 'reject', label: '退回补正', danger: true, needReason: true });
    }
    if (status === 'correction' && role === 'registrar') {
      actions.push({ value: 'resubmit', label: '重新提交审核', evidenceRequired: true });
    }
    if (status === 'pending_review' && role === 'manager') {
      actions.push({ value: 'archive', label: '复核通过，归档办结', evidenceRequired: true });
      actions.push({ value: 'send_back', label: '退回补正', danger: true, needReason: true });
    }

    return actions;
  }

  get requiredEvidence(): { value: string; label: string }[] {
    if (!this.order) return [];
    const status = this.order.status;
    const role = this.currentUser?.role;

    if (status === 'draft' && role === 'registrar') {
      return EVIDENCE_TYPES.filter(e => ['registration_form', 'vehicle_checklist'].includes(e.value));
    }
    if (status === 'pending_audit' && role === 'supervisor') {
      return EVIDENCE_TYPES.filter(e => ['inspection_report', 'repair_quote', 'parts_confirmation'].includes(e.value));
    }
    if (status === 'correction' && role === 'registrar') {
      return EVIDENCE_TYPES.filter(e => ['registration_form', 'vehicle_checklist'].includes(e.value));
    }
    if (status === 'pending_review' && role === 'manager') {
      return EVIDENCE_TYPES.filter(e => ['final_inspection', 'delivery_note', 'customer_confirmation'].includes(e.value));
    }
    return [];
  }

  get allEvidenceFulfilled(): boolean {
    if (this.requiredEvidence.length === 0) return true;
    return this.requiredEvidence.every(ev => this.hasEvidence(ev.value));
  }

  hasEvidence(type: string): boolean {
    if (!this.order) return false;
    return this.order.attachments.some(a => a.evidence_type === type);
  }

  getEvidenceLabel(type: string): string {
    const ev = EVIDENCE_TYPES.find(e => e.value === type);
    return ev ? ev.label : type;
  }

  getActionButtonStyle(action: { danger?: boolean }): string {
    return action.danger ? '#ff4d4f' : '#1890ff';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadError = '';
      this.uploadSuccess = '';
    }
  }

  quickUpload(evidenceType: string): void {
    this.showUploadForm = true;
    this.uploadEvidenceType = evidenceType;
    this.uploadError = '';
    this.uploadSuccess = '';
  }

  uploadFile(): void {
    if (!this.order || !this.selectedFile || !this.uploadEvidenceType) return;

    this.uploading = true;
    this.uploadError = '';
    this.uploadSuccess = '';

    this.apiService.uploadAttachment(this.order.id, this.selectedFile, this.uploadEvidenceType).subscribe({
      next: () => {
        this.uploading = false;
        this.uploadSuccess = '上传成功！';
        this.selectedFile = null;
        this.uploadEvidenceType = '';
        this.loadDetail(this.order!.id);
        setTimeout(() => { this.uploadSuccess = ''; }, 3000);
      },
      error: err => {
        this.uploading = false;
        this.uploadError = err.error?.error || '上传失败';
      }
    });
  }

  getDownloadUrl(attachmentId: number): string {
    return this.apiService.getAttachmentDownloadUrl(attachmentId);
  }

  loadDetail(id: number): void {
    this.loading = true;
    this.apiService.getWorkOrderDetail(id).subscribe({
      next: data => {
        this.order = data;
        this.processForm.version = data.version;
        this.loading = false;
      },
      error: err => {
        this.error = err.error?.error || '加载失败';
        this.loading = false;
      }
    });
  }

  executeAction(action: string, needReason: boolean = false): void {
    if (!this.order) return;

    if (needReason && !this.processForm.exception_reason?.trim()) {
      this.exceptionReasonRequired = true;
      this.error = '退回补正操作必须填写异常原因';
      return;
    } else {
      this.exceptionReasonRequired = false;
    }

    const actionDef = this.availableActions.find(a => a.value === action);
    if (actionDef?.evidenceRequired && !this.allEvidenceFulfilled) {
      this.error = '必填证据尚未齐全，无法推进。请先上传缺失的证据附件。';
      return;
    }

    this.loading = true;
    this.error = '';

    const req: WorkOrderProcessRequest = {
      action,
      remark: this.processForm.remark,
      exception_reason: this.processForm.exception_reason,
      version: this.order.version
    };

    this.apiService.processWorkOrder(this.order.id, req).subscribe({
      next: data => {
        this.order = data;
        this.processForm.version = data.version;
        this.processForm.remark = '';
        this.processForm.exception_reason = '';
        this.processForm.action = '';
        this.exceptionReasonRequired = false;
        this.loading = false;
      },
      error: err => {
        this.error = err.error?.error || '处理失败';
        this.loading = false;
        if (err.status === 409) {
          this.loadDetail(this.order!.id);
        }
      }
    });
  }

  addAuditNote(): void {
    if (!this.order || !this.newAuditNote.trim()) return;

    this.apiService.addAuditNote(this.order.id, this.newAuditNote.trim()).subscribe({
      next: () => {
        this.newAuditNote = '';
        this.loadDetail(this.order!.id);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/registration']);
  }

  getStatusBg(status: string): string {
    const map: Record<string, string> = {
      draft: '#f5f5f5',
      pending_audit: '#fff7e6',
      pending_review: '#e6f7ff',
      correction: '#fff1f0',
      completed: '#f6ffed',
      rejected: '#fff1f0'
    };
    return map[status] || '#f5f5f5';
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      draft: '#666',
      pending_audit: '#fa8c16',
      pending_review: '#1890ff',
      correction: '#ff4d4f',
      completed: '#52c41a',
      rejected: '#ff4d4f'
    };
    return map[status] || '#666';
  }

  formatDateTime(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
