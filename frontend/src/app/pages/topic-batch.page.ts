import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TopicService, AuthService, UserService } from '../services/api.service';
import {
  Topic,
  TOPIC_STATUS_LABEL,
  TOPIC_STATUS_COLOR,
  WARNING_LABEL,
  ROLE_SHORT_LABEL,
  ApiError,
  BatchProcessRequest,
  BatchProcessResponse,
  BatchResultItem,
  UserInfo,
  ProcessTopicRequest,
} from '../models';

@Component({
  selector: 'app-topic-batch',
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
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    MatSnackBarModule,
    MatButtonToggleModule,
  ],
  template: `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <button mat-icon-button routerLink="/topics" style="margin-right:8px;"><mat-icon>arrow_back</mat-icon></button>
          <span style="font-size:24px;font-weight:700;color:#111827;">⚡ 批量处理选题单</span>
        </div>
        <div style="display:flex;gap:10px;">
          <button mat-stroked-button routerLink="/topics">
            <mat-icon style="margin-right:4px;">add</mat-icon>从列表添加
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 380px;gap:20px;">
        <div>
          <mat-card style="padding:0;margin-bottom:18px;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);">
              <div>
                <div style="font-weight:700;font-size:14.5px;">处理清单（{{ selectedTopics.length }} 条）</div>
                <div style="font-size:12px;color:#4338ca88;margin-top:2px;">逾期条目将被逐条拦截，不会整批放行</div>
              </div>
              <button *ngIf="selectedTopics.length > 0" mat-stroked-button color="warn" (click)="clearAll()">
                <mat-icon style="margin-right:4px;">clear_all</mat-icon>清空
              </button>
            </div>
            <div *ngIf="selectedTopics.length === 0" style="padding:60px 20px;text-align:center;color:#9ca3af;">
              <div style="font-size:48px;margin-bottom:8px;">📭</div>
              <div style="margin-bottom:8px;">暂无待处理选题单</div>
              <div style="font-size:12.5px;">请在「选题单列表」勾选条目后点击「批量处理」进入</div>
              <button mat-raised-button color="primary" routerLink="/topics" style="margin-top:16px;">
                <mat-icon style="margin-right:4px;">list</mat-icon>前往列表选择
              </button>
            </div>
            <table *ngIf="selectedTopics.length > 0" mat-table [dataSource]="selectedTopics" style="width:100%;">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef style="min-width:260px;">选题单</th>
                <td mat-cell *matCellDef="let row">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <button
                      mat-icon-button
                      color="warn"
                      (click)="removeItem(row)"
                      style="width:28px;height:28px;line-height:28px;"
                      matTooltip="移出本批"
                    ><mat-icon style="font-size:18px;">close</mat-icon></button>
                    <div>
                      <div style="font-weight:600;color:#111827;">{{ row.title }}</div>
                      <div style="font-size:11.5px;color:#6b7280;font-family:monospace;">#{{ row.id.slice(0,8).toUpperCase() }} · v{{ row.version }} · {{ row.category }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef style="width:100px;">状态</th>
                <td mat-cell *matCellDef="let row">
                  <span
                    style="padding:3px 10px;border-radius:14px;font-size:11.5px;font-weight:600;color:white;"
                    [style.background]="TOPIC_STATUS_COLOR[row.status]"
                  >{{ TOPIC_STATUS_LABEL[row.status] }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="warning">
                <th mat-header-cell *matHeaderCellDef style="width:80px;">预警</th>
                <td mat-cell *matCellDef="let row">
                  <span
                    *ngIf="row.warning_level"
                    style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;"
                    [style.background]="WARNING_LABEL[row.warning_level].color + '18'"
                    [style.color]="WARNING_LABEL[row.warning_level].color"
                  >
                    {{ WARNING_LABEL[row.warning_level].label }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="handler">
                <th mat-header-cell *matHeaderCellDef style="width:130px;">当前处理人</th>
                <td mat-cell *matCellDef="let row">
                  <div style="font-size:12.5px;">{{ row.current_handler_name || '—' }}</div>
                  <div *ngIf="row.is_overdue && row.current_handler_name" style="font-size:11px;color:#dc2626;font-weight:600;">⚠ 责任人超时</div>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['title','status','warning','handler']"></tr>
              <tr mat-row *matRowDef="let r; columns: ['title','status','warning','handler'];"></tr>
            </table>
          </mat-card>

          <mat-card *ngIf="result" style="padding:0;overflow:hidden;">
            <div
              style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;"
              [style.background]="result.failed_count > 0 ? 'linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)' : 'linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%)'"
            >
              <div>
                <div style="font-weight:700;font-size:14.5px;">📊 批量处理结果</div>
                <div style="font-size:12.5px;margin-top:2px;">
                  共 <b>{{ result.total }}</b> 条 ·
                  <span style="color:#16a34a;">成功 {{ result.success_count }}</span> ·
                  <span style="color:#dc2626;">失败 {{ result.failed_count }}</span>
                </div>
              </div>
              <button mat-stroked-button (click)="result = null;">隐藏结果</button>
            </div>
            <table mat-table [dataSource]="result.results" style="width:100%;">
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef style="width:72px;">结果</th>
                <td mat-cell *matCellDef="let r">
                  <span
                    matTooltip="{{ r.success ? '处理成功' : (r.error_message || '失败') }}"
                    style="display:inline-block;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;font-weight:700;color:white;"
                    [style.background]="r.success ? '#16a34a' : '#dc2626'"
                  >{{ r.success ? '✓' : '✗' }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef style="min-width:280px;">选题单</th>
                <td mat-cell *matCellDef="let r">
                  <div style="font-weight:600;color:#111827;">{{ r.title }}</div>
                  <div style="font-size:11.5px;color:#6b7280;font-family:monospace;">#{{ r.id.slice(0,8).toUpperCase() }}</div>
                </td>
              </ng-container>
              <ng-container matColumnDef="error">
                <th mat-header-cell *matHeaderCellDef>成功/失败原因</th>
                <td mat-cell *matCellDef="let r">
                  <div *ngIf="r.success" style="color:#166534;font-size:12.5px;">
                    <div>新状态：<b>{{ TOPIC_STATUS_LABEL[(r.new_status as any) || 'processing'] || r.new_status || '—' }}</b>　版本：v{{ r.new_version || '—' }}</div>
                    <div *ngIf="r.audit_summary" style="margin-top:3px;font-size:11.5px;color:#6b7280;">📝 {{ r.audit_summary }}</div>
                    <div *ngIf="r.record_id" style="font-size:10.5px;color:#9ca3af;font-family:monospace;margin-top:2px;">记录#{{ r.record_id.slice(0,8).toUpperCase() }}</div>
                  </div>
                  <div *ngIf="!r.success">
                    <div style="display:flex;align-items:flex-start;gap:6px;">
                      <span style="font-family:monospace;font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;flex-shrink:0;margin-top:2px;">{{ r.error_code }}</span>
                      <span style="color:#991b1b;font-size:12.5px;line-height:1.55;">{{ r.error_message }}</span>
                    </div>
                    <button
                      *ngIf="r.error_code !== 'NOT_FOUND'"
                      mat-button
                      style="margin-top:4px;padding:0;font-size:11.5px;color:#2563eb;min-height:0;line-height:20px;"
                      (click)="router.navigate(['/topics', r.id])"
                    >→ 前往详情页处理</button>
                  </div>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="['status','title','error']"></tr>
              <tr mat-row *matRowDef="let r; columns: ['status','title','error'];"></tr>
            </table>
          </mat-card>
        </div>

        <div>
          <mat-card style="padding:20px;margin-bottom:16px;">
            <h4 style="font-size:14px;font-weight:600;margin:0 0 14px;">⚙️ 操作配置</h4>
            <form [formGroup]="form" (ngSubmit)="submit()">
              <div style="margin-bottom:14px;">
                <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:500;">批量操作类型</div>
                <mat-button-toggle-group style="display:flex;flex-wrap:wrap;gap:6px;border:0;background:transparent;">
                  <button
                    *ngFor="let a of availableActions"
                    type="button"
                    (click)="selectAction(a.key)"
                    style="flex:1;min-width:45%;border:1.5px solid;border-radius:8px;padding:10px 8px;background:white;cursor:pointer;transition:all 0.15s;"
                    [style.border-color]="form.value.action === a.key ? a.color : '#e5e7eb'"
                    [style.background]="form.value.action === a.key ? a.color + '12' : 'white'"
                    [style.color]="form.value.action === a.key ? a.color : '#374151'"
                  >
                    <div style="font-size:16px;">{{ a.icon }}</div>
                    <div style="font-weight:600;font-size:12.5px;">{{ a.label }}</div>
                  </button>
                </mat-button-toggle-group>
                <div *ngIf="!form.value.action" style="font-size:11.5px;color:#dc2626;margin-top:6px;">请选择操作类型</div>
              </div>

              <div *ngIf="form.value.action === 'dispatch'">
                <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:500;">
                  <span style="color:#ef4444;">*</span> 指定处理人
                </div>
                <mat-form-field appearance="outline" style="width:100%;margin:0;">
                  <mat-select formControlName="target_handler_id">
                    <mat-option *ngFor="let u of nextHandlerOptions" [value]="u.id">
                      {{ u.display_name }}（{{ ROLE_SHORT_LABEL[u.role] }}）
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div style="margin-top:14px;">
                <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:500;">
                  <span style="color:#ef4444;">*</span> 批量处理意见
                </div>
                <mat-form-field appearance="outline" style="width:100%;margin:0;">
                  <textarea matInput rows="3" formControlName="opinion" placeholder="请填写统一的处理意见，每一条会自动附加上审计备注"></textarea>
                  <mat-hint align="end">{{ form.value.opinion?.length || 0 }}字</mat-hint>
                </mat-form-field>
              </div>

              <div style="margin-top:8px;">
                <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:500;">审计备注（可选）</div>
                <mat-form-field appearance="outline" style="width:100%;margin:0;">
                  <input matInput formControlName="remark" placeholder="可选：批次说明等" />
                </mat-form-field>
              </div>

              <div
                *ngIf="hasOverdue && (form.value.action === 'dispatch' || form.value.action === 'close')"
                style="margin:14px 0;padding:12px 14px;background:#fee2e2;border-radius:8px;font-size:12px;color:#991b1b;line-height:1.65;"
              >
                <div style="font-weight:600;margin-bottom:4px;">🔴 存在逾期条目</div>
                本批包含 <b>{{ overdueCount }}</b> 条已逾期题单，这些条目在执行
                <b>{{ form.value.action === 'dispatch' ? '派发' : '关闭' }}</b>
                时将被<b>逐条拦截并标记失败</b>，不会整批放行。请前往详情页手动处理逾期补正后再批量操作。
              </div>

              <div
                *ngIf="actionEvidenceNote"
                style="margin:14px 0;padding:12px 14px;background:#fef3c7;border-radius:8px;font-size:12px;color:#92400e;line-height:1.65;"
              >
                <div style="font-weight:600;margin-bottom:4px;">⚠ 证据提醒</div>
                {{ actionEvidenceNote }}
              </div>

              <div style="margin-top:20px;display:flex;gap:10px;">
                <button type="button" mat-stroked-button style="flex:1;" (click)="resetForm()">重置</button>
                <button
                  type="submit"
                  mat-raised-button
                  color="primary"
                  style="flex:2;"
                  [disabled]="processing || !canSubmit"
                >
                  {{ processing ? '处理中...' : confirmButtonText }}
                </button>
              </div>
            </form>
          </mat-card>

          <mat-card style="padding:16px 18px;">
            <h4 style="font-size:13px;font-weight:600;margin:0 0 10px;">📖 操作说明</h4>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:#4b5563;line-height:1.8;">
              <li>角色不同，可执行的批量操作也不同</li>
              <li>系统会逐条校验权限、状态、版本、责任人，异常条目不会影响其他</li>
              <li>提交复核 / 关闭 要求三类证据齐全（申报、采访、稿件）</li>
              <li>逾期题单不允许批量派发/关闭，需详情页手动处理</li>
              <li>处理记录会写入每条题单的审计轨迹</li>
            </ul>
          </mat-card>
        </div>
      </div>
    </div>
  `,
})
export class TopicBatchPageComponent implements OnInit {
  form: FormGroup;
  selectedTopics: Topic[] = [];
  result: BatchProcessResponse | null = null;
  processing = false;
  userList: UserInfo[] = [];
  user = this.auth.currentUser;
  TOPIC_STATUS_LABEL = TOPIC_STATUS_LABEL;
  TOPIC_STATUS_COLOR = TOPIC_STATUS_COLOR;
  WARNING_LABEL = WARNING_LABEL;
  ROLE_SHORT_LABEL = ROLE_SHORT_LABEL;

  availableActions: { key: ProcessTopicRequest['action']; label: string; icon: string; color: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private topicService: TopicService,
    private auth: AuthService,
    private userService: UserService,
    private fb: FormBuilder,
    private snack: MatSnackBar
  ) {
    this.form = this.fb.group({
      action: ['', [Validators.required]],
      target_handler_id: [''],
      opinion: ['', [Validators.required, Validators.minLength(4)]],
      remark: [''],
    });
  }

  ngOnInit() {
    this.auth.user$.subscribe((u) => (this.user = u));
    this.userService.list().subscribe({ next: (l) => (this.userList = l) });
    this.computeActions();
    this.route.queryParams.subscribe((q) => {
      const ids: string[] = (q['ids'] || '').split(',').filter(Boolean);
      const versionsRaw: string = q['versions'] || '';
      const versions: Record<string, number> = {};
      versionsRaw.split(',').filter(Boolean).forEach((p) => {
        const [k, v] = p.split(':');
        if (k && v) versions[k] = parseInt(v, 10) || 1;
      });
      if (ids.length) {
        this.loadTopics(ids, versions);
      }
    });
  }

  computeActions() {
    const role = this.user?.role;
    this.availableActions = [];
    if (role === 'auditor') {
      this.availableActions.push({ key: 'dispatch', label: '派发/领取', icon: '📤', color: '#2563eb' });
      this.availableActions.push({ key: 'progress', label: '进度更新', icon: '📝', color: '#0ea5e9' });
      this.availableActions.push({ key: 'return', label: '退回补正', icon: '↩️', color: '#f59e0b' });
      this.availableActions.push({ key: 'submit_review', label: '提交复核', icon: '🔍', color: '#10b981' });
    } else if (role === 'reviewer') {
      this.availableActions.push({ key: 'progress', label: '进度更新', icon: '📝', color: '#0ea5e9' });
      this.availableActions.push({ key: 'return', label: '退回补正', icon: '↩️', color: '#f59e0b' });
      this.availableActions.push({ key: 'close', label: '关闭题单', icon: '✅', color: '#16a34a' });
      this.availableActions.push({ key: 'archive', label: '归档', icon: '🗂️', color: '#6b7280' });
    } else if (role === 'registrar') {
      this.availableActions.push({ key: 'dispatch', label: '重新提交', icon: '🔁', color: '#2563eb' });
    }
  }

  selectAction(key: string) {
    this.form.patchValue({ action: key });
  }

  resetForm() {
    this.form.reset({ action: '', target_handler_id: '', opinion: '', remark: '' });
  }

  get overdueCount(): number {
    return this.selectedTopics.filter((t) => t.is_overdue).length;
  }
  get hasOverdue(): boolean {
    return this.overdueCount > 0;
  }
  get nextHandlerOptions(): UserInfo[] {
    if (!this.user) return [];
    if (this.user.role === 'registrar') return this.userList.filter((u) => u.role === 'auditor');
    return this.userList.filter((u) => u.id !== this.user?.id && u.role !== 'registrar');
  }
  get actionEvidenceNote(): string | null {
    const a = this.form.value.action;
    if (a === 'submit_review') return '提交复核要求每条题单都具备「选题申报」「采访安排」「稿件提交」三类附件，缺失将被逐条拦截。';
    if (a === 'close') return '关闭要求每条题单都具备三类证据附件，缺失将被逐条拦截。';
    return null;
  }
  get canSubmit(): boolean {
    if (!this.form.valid) return false;
    if (this.selectedTopics.length === 0) return false;
    const a = this.form.value.action;
    if (a === 'dispatch' && this.user?.role === 'registrar' && !this.form.value.target_handler_id) return false;
    return true;
  }
  get confirmButtonText(): string {
    return `确认执行（${this.selectedTopics.length}条）`;
  }

  loadTopics(ids: string[], versions: Record<string, number>) {
    const loaded: Topic[] = [];
    let pending = ids.length;
    if (pending === 0) return;
    ids.forEach((id) => {
      this.topicService.detail(id).subscribe({
        next: (d) => {
          const t: Topic = {
            ...d.topic,
            warning_level: d.warning_level as any,
            is_overdue: d.is_overdue,
            version: versions[id] || d.topic.version,
          };
          loaded.push(t);
          pending--;
          if (pending === 0) {
            this.selectedTopics = loaded;
          }
        },
        error: () => {
          pending--;
          if (pending === 0) this.selectedTopics = loaded;
        },
      });
    });
  }

  removeItem(t: Topic) {
    this.selectedTopics = this.selectedTopics.filter((x) => x.id !== t.id);
  }
  clearAll() {
    this.selectedTopics = [];
    this.result = null;
  }

  submit() {
    if (!this.canSubmit) return;
    this.processing = true;
    const v = this.form.value;
    const versions: Record<string, number> = {};
    this.selectedTopics.forEach((t) => (versions[t.id] = t.version));
    const req: BatchProcessRequest = {
      ids: this.selectedTopics.map((t) => t.id),
      action: v.action,
      opinion: v.opinion,
      remark: v.remark || null,
      target_handler_id: v.target_handler_id || null,
      versions,
    };
    this.topicService.batch(req).subscribe({
      next: (r) => {
        this.processing = false;
        this.result = r;
        this.snack.open(
          `批量完成：成功${r.success_count}条，失败${r.failed_count}条`,
          r.failed_count > 0 ? '查看明细' : '好的',
          { duration: r.failed_count > 0 ? 7000 : 4000 }
        );
        const failedIds = new Set(r.results.filter((x) => !x.success).map((x) => x.id));
        this.selectedTopics = this.selectedTopics.filter((t) => failedIds.has(t.id));
      },
      error: (e: ApiError) => {
        this.processing = false;
        this.snack.open(`批量操作失败：${e.message}`, '知道了', { duration: 6000 });
      },
    });
  }
}
