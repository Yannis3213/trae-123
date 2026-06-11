import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { LaunchPlanService } from '../../services/launch-plan.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { User } from '../../models/launch-plan';

@Component({
  selector: 'app-create-plan-modal',
  template: `
    <div class="modal-overlay" (click.self)="close.emit(false)">
      <div class="modal" style="width:680px;max-width:92vw">
        <div class="modal-header">
          <span>📝 新建上线计划单</span>
          <button class="modal-close" (click)="close.emit(false)">×</button>
        </div>
        <div class="modal-body">
          <div *ngIf="errorMsg" class="alert alert-error">{{errorMsg}}</div>

          <div class="flex gap-md">
            <div class="form-item flex-1">
              <label class="form-label required">客户名称</label>
              <input class="input" [(ngModel)]="form.customer_name" placeholder="例如：北京云端科技有限公司">
            </div>
            <div class="form-item flex-1">
              <label class="form-label required">项目名称</label>
              <input class="input" [(ngModel)]="form.project_name" placeholder="例如：SaaS CRM系统上线">
            </div>
          </div>

          <div class="flex gap-md">
            <div class="form-item" style="flex:1">
              <label class="form-label required">优先级</label>
              <select class="select" [(ngModel)]="form.priority">
                <option value="urgent">紧急（最高）</option>
                <option value="high">高</option>
                <option value="medium" selected>中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div class="form-item" style="flex:1">
              <label class="form-label required">截止日期</label>
              <input type="date" class="input" [(ngModel)]="form.deadline">
            </div>
            <div class="form-item" style="flex:1">
              <label class="form-label required">责任人</label>
              <select class="select" [(ngModel)]="form.owner">
                <option *ngFor="let u of owners" [value]="u.name">
                  {{u.name}}（{{u.role_name}}）
                </option>
              </select>
            </div>
          </div>

          <div class="flex gap-md">
            <div class="form-item" style="flex:1">
              <label class="form-label">🔄 指派交付顾问（可选，建单后直接流转）</label>
              <select class="select" [(ngModel)]="form.assignee">
                <option value="">不指派（后续在详情页指派）</option>
                <option *ngFor="let u of deliveryConsultants" [value]="u.name">
                  {{u.name}}（{{u.role_name}}）
                </option>
              </select>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">🎯 上线目标</label>
            <textarea class="textarea" rows="3" [(ngModel)]="form.launch_target"
              placeholder="请详细描述本次上线要达成的目标，例如：完成CRM系统部署、用户数据迁移、基础配置..."></textarea>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
              提交复核前必须填写完整（≥10字）
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">✔️ 配置检查清单</label>
            <textarea class="textarea" rows="3" [(ngModel)]="form.config_checklist"
              placeholder="请逐项列出配置检查内容，例如：1. 数据库配置完成\n2. 用户权限配置完成\n3. 第三方集成配置完成"></textarea>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
              提交复核前必须填写完整（≥10字）
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">✅ 验收确认内容</label>
            <textarea class="textarea" rows="2" [(ngModel)]="form.acceptance_notes"
              placeholder="归档前请填写客户方验收确认信息，例如：客户方IT总监张某某于2026-06-01签字确认UAT通过"></textarea>
          </div>

          <div class="alert alert-info">
            👤 创建人：{{currentUser.name}}（{{currentUser.role_name}}）· 初始状态：草稿 ·
            <span *ngIf="form.assignee">指派后将流转给交付顾问 {{form.assignee}} 办理</span>
            <span *ngIf="!form.assignee">提交复核后处理人将变更为客户成功负责人</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" (click)="close.emit(false)">取消</button>
          <button class="btn btn-primary" [disabled]="submitting" (click)="submit()">
            {{submitting ? '保存中...' : '创建计划单'}}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`.flex-1 { flex: 1; min-width: 0; }`],
})
export class CreatePlanModalComponent implements OnInit {
  @Output() close = new EventEmitter<boolean>();

  owners: User[] = [];
  submitting = false;
  errorMsg = '';

  form: any = {
    customer_name: '',
    project_name: '',
    priority: 'medium',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    owner: '',
    assignee: '',
    launch_target: '',
    config_checklist: '',
    acceptance_notes: '',
  };

  constructor(
    private svc: LaunchPlanService,
    public auth: AuthService,
    private toast: ToastService,
  ) {}

  get currentUser() { return this.auth.currentUser; }

  get deliveryConsultants(): User[] {
    return this.auth.getAllUsers().filter(u => u.role === 'delivery_consultant');
  }

  ngOnInit() {
    this.owners = this.auth.getAllUsers().filter(u =>
      ['cs_manager', 'delivery_consultant'].includes(u.role)
    );
    if (!this.form.owner && this.currentUser && this.owners.some(u => u.name === this.currentUser.name)) {
      this.form.owner = this.currentUser.name;
    }
  }

  submit() {
    this.errorMsg = '';
    if (!this.form.customer_name.trim()) { this.errorMsg = '请填写客户名称'; return; }
    if (!this.form.project_name.trim()) { this.errorMsg = '请填写项目名称'; return; }
    if (!this.form.deadline) { this.errorMsg = '请选择截止日期'; return; }
    if (!this.form.owner) { this.errorMsg = '请选择责任人'; return; }

    this.submitting = true;
    this.svc.create(this.form).subscribe(
      (r) => {
        this.toast.success(`计划单 ${r.plan_no} 创建成功`);
        this.submitting = false;
        this.close.emit(true);
      },
      (e) => {
        this.errorMsg = e.error?.error || '创建失败，请重试';
        this.submitting = false;
      }
    );
  }
}
