import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TopicService, AuthService, UserService } from '../services/api.service';
import {
  Topic,
  TopicDetailResponse,
  Attachment,
  ProcessRecord,
  AuditLog,
  UserInfo,
  TOPIC_STATUS_LABEL,
  TOPIC_STATUS_COLOR,
  WARNING_LABEL,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  ROLE_SHORT_LABEL,
  ACTION_LABELS,
  ApiError,
  ProcessTopicRequest,
  AttachmentInput,
  UserRole,
} from '../models';

interface ActionOption {
  key: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
  needsHandler?: boolean;
  needsEvidence?: boolean;
}

@Component({
  selector: 'app-topic-detail',
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
    MatTabsModule,
    MatTableModule,
    MatDividerModule,
    MatChipsModule,
    MatTooltipModule,
    MatStepperModule,
    MatSnackBarModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div *ngIf="loading && !detail" style="padding:80px;text-align:center;">
      <mat-spinner style="margin:0 auto 12px;"></mat-spinner>
      <div style="color:#6b7280;">正在加载选题单详情...</div>
    </div>
    <div *ngIf="!loading && detail">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <button mat-icon-button routerLink="/topics"><mat-icon>arrow_back</mat-icon></button>
          <div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
              <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0;">{{ detail.topic.title }}</h2>
              <span
                style="padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600;color:white;"
                [style.background]="TOPIC_STATUS_COLOR[detail.topic.status]"
              >
                {{ TOPIC_STATUS_LABEL[detail.topic.status] }}
              </span>
              <span
                *ngIf="detail.topic.warning_level"
                matTooltip="{{ detail.is_overdue ? '已逾期，责任人：' + (detail.topic.current_handler_name || '—') : (detail.topic.warning_level === 'warning' ? '临近截止时间' : '正常') }}"
                style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;"
                [style.color]="WARNING_LABEL[detail.topic.warning_level].color"
                [style.background]="WARNING_LABEL[detail.topic.warning_level].color + '18'"
              >
                <span *ngIf="detail.is_overdue" style="font-size:14px;">🔴</span>
                <span *ngIf="detail.topic.warning_level === 'warning' && !detail.is_overdue" style="font-size:14px;">🟡</span>
                <span *ngIf="detail.topic.warning_level === 'normal'" style="font-size:14px;">🟢</span>
                {{ WARNING_LABEL[detail.topic.warning_level].label }}
                <span *ngIf="detail.is_overdue" style="margin-left:4px;">· {{ detail.overdue_reason }}</span>
              </span>
              <span style="font-family:monospace;font-size:12px;color:#9ca3af;background:#f3f4f6;padding:3px 8px;border-radius:6px;">v{{ detail.topic.version }}</span>
            </div>
            <div style="font-size:13px;color:#6b7280;">
              <span *ngIf="detail.topic.current_handler_name">当前处理人：<b style="color:#1f2937;">{{ detail.topic.current_handler_name }}</b>　</span>
              <span *ngIf="detail.topic.applicant_name">申报人：{{ detail.topic.applicant_name }}　</span>
              分类：{{ detail.topic.category }} · 优先级：{{ priorityLabel(detail.topic.priority) }}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button mat-stroked-button (click)="refresh()">
            <mat-icon style="margin-right:4px;">refresh</mat-icon>刷新
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;">
        <div>
          <mat-card style="padding:0;margin-bottom:18px;overflow:hidden;">
            <mat-tab-group #tabs>
              <mat-tab label="📄 基本信息与办理">
                <div style="padding:24px;">
                  <h4 style="font-size:14px;color:#374151;margin:0 0 12px;font-weight:600;">选题基本信息</h4>
                  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px 28px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px dashed #e5e7eb;">
                    <div><span style="color:#6b7280;font-size:12.5px;">来源：</span><b>{{ detail.topic.source }}</b></div>
                    <div><span style="color:#6b7280;font-size:12.5px;">编号：</span><span style="font-family:monospace;">{{ detail.topic.id.slice(0,8).toUpperCase() }}...</span></div>
                    <div><span style="color:#6b7280;font-size:12.5px;">创建时间：</span>{{ formatDate(detail.topic.created_at) }}</div>
                    <div><span style="color:#6b7280;font-size:12.5px;">更新时间：</span>{{ formatDate(detail.topic.updated_at) }}</div>
                    <div><span style="color:#6b7280;font-size:12.5px;">采访截止：</span><b [class.overdue-text]="isPast(detail.topic.interview_deadline)">{{ detail.topic.interview_deadline ? formatDate(detail.topic.interview_deadline) : '—' }}</b></div>
                    <div><span style="color:#6b7280;font-size:12.5px;">稿件截止：</span><b [class.overdue-text]="isPast(detail.topic.submission_deadline)">{{ detail.topic.submission_deadline ? formatDate(detail.topic.submission_deadline) : '—' }}</b></div>
                  </div>
                  <div style="margin-bottom:24px;">
                    <h4 style="font-size:14px;color:#374151;margin:0 0 10px;font-weight:600;">选题描述</h4>
                    <div style="background:#f9fafb;padding:14px 16px;border-radius:8px;font-size:13.5px;line-height:1.8;color:#1f2937;white-space:pre-wrap;">{{ detail.topic.description }}</div>
                  </div>
                  <div *ngIf="canEditBasicInfo">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                      <h4 style="font-size:14px;color:#374151;margin:0;font-weight:600;">修改基本信息</h4>
                      <span style="font-size:11.5px;color:#6b7280;">（退回补正或本人为当前处理人时可修改）</span>
                    </div>
                    <form [formGroup]="editForm" style="padding:16px;background:#fef3c71a;border:1px solid #fde68a55;border-radius:10px;">
                      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
                        <mat-form-field appearance="outline" style="margin:0;"><mat-label>标题</mat-label><input matInput formControlName="title" /></mat-form-field>
                        <mat-form-field appearance="outline" style="margin:0;"><mat-label>来源</mat-label><input matInput formControlName="source" /></mat-form-field>
                        <mat-form-field appearance="outline" style="grid-column:1/3;margin:0;"><mat-label>描述</mat-label><textarea matInput rows="2" formControlName="description"></textarea></mat-form-field>
                        <mat-form-field appearance="outline" style="margin:0;"><mat-label>优先级</mat-label><mat-select formControlName="priority"><mat-option *ngFor="let p of PRIORITY_OPTIONS" [value]="p.value">{{ p.label }}</mat-option></mat-select></mat-form-field>
                        <mat-form-field appearance="outline" style="margin:0;"><mat-label>分类</mat-label><mat-select formControlName="category"><mat-option *ngFor="let c of CATEGORY_OPTIONS" [value]="c">{{ c }}</mat-option></mat-select></mat-form-field>
                      </div>
                      <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;">
                        <button type="button" mat-stroked-button (click)="fillEditForm()">重置</button>
                        <button type="button" mat-raised-button color="primary" (click)="saveBasic()" [disabled]="savingEdit || editForm.pristine">
                          {{ savingEdit ? '保存中...' : '保存修改' }}
                        </button>
                      </div>
                    </form>
                  </div>

                  <mat-divider style="margin:28px 0;"></mat-divider>

                  <div style="margin-bottom:20px;">
                    <h4 style="font-size:14px;color:#374151;margin:0 0 14px;font-weight:600;">🔁 流程状态图</h4>
                    <div style="display:flex;align-items:center;gap:6px;padding:16px 20px;background:linear-gradient(135deg,#f0f9ff 0%,#fef3c725 100%);border-radius:12px;">
                      <div *ngFor="let s of flowStatuses; let i = index" style="display:flex;align-items:center;">
                        <div
                          style="width:84px;height:76px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;"
                          [style.background]="statusIndexOf(detail.topic.status) >= i ? TOPIC_STATUS_COLOR[s.key] + '22' : '#f3f4f6'"
                          [style.border]="'2px solid ' + (statusIndexOf(detail.topic.status) >= i ? TOPIC_STATUS_COLOR[s.key] : '#e5e7eb')"
                        >
                          <div style="font-size:18px;">{{ s.icon }}</div>
                          <div style="font-size:11.5px;font-weight:600;" [style.color]="statusIndexOf(detail.topic.status) >= i ? TOPIC_STATUS_COLOR[s.key] : '#9ca3af'">{{ s.label }}</div>
                        </div>
                        <div *ngIf="i < flowStatuses.length - 1" style="width:32px;height:3px;margin:0 4px;" [style.background]="statusIndexOf(detail.topic.status) > i ? '#9ca3af' : '#e5e7eb'"></div>
                      </div>
                    </div>
                  </div>

                  <div *ngIf="availableActions.length > 0">
                    <h4 style="font-size:14px;color:#374151;margin:0 0 14px;font-weight:600;">✅ 办理操作（按当前角色与状态可用）</h4>
                    <form [formGroup]="actionForm" style="padding:18px 20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                      <div style="display:grid;gap:10px;margin-bottom:14px;" [style.grid-template-columns]="'repeat(' + Math.min(availableActions.length, 4) + ', 1fr)'">
                        <div
                          *ngFor="let a of availableActions"
                          (click)="selectAction(a)"
                          style="padding:12px 14px;border-radius:10px;cursor:pointer;transition:all 0.15s;"
                          [style.background]="selectedAction?.key === a.key ? a.color + '18' : 'white'"
                          [style.border]="selectedAction?.key === a.key ? '2px solid ' + a.color : '2px solid #e5e7eb'"
                        >
                          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                            <span [style.color]="a.color;" style="font-size:16px;">{{ a.icon }}</span>
                            <b style="font-size:13.5px;" [style.color]="selectedAction?.key === a.key ? a.color : '#111827';">{{ a.label }}</b>
                          </div>
                          <div style="font-size:11.5px;color:#6b7280;line-height:1.5;">{{ a.desc }}</div>
                        </div>
                      </div>
                      <div *ngIf="selectedAction?.needsHandler" style="margin-bottom:14px;">
                        <mat-form-field appearance="outline" style="width:100%;margin:0;">
                          <mat-label><span style="color:#ef4444;">*</span> 指定下一处理人</mat-label>
                          <mat-select formControlName="target_handler_id">
                            <mat-option *ngFor="let u of nextHandlerOptions" [value]="u.id">
                              {{ u.display_name }}（{{ ROLE_SHORT_LABEL[u.role] }}）
                            </mat-option>
                          </mat-select>
                        </mat-form-field>
                      </div>
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <mat-form-field appearance="outline" style="margin:0;grid-column:1/3;">
                          <mat-label><span style="color:#ef4444;">*</span> 处理意见</mat-label>
                          <textarea matInput rows="2" formControlName="opinion" placeholder="请填写明确的处理意见，这会作为审计记录留存"></textarea>
                        </mat-form-field>
                        <mat-form-field appearance="outline" style="margin:0;grid-column:1/3;">
                          <mat-label>审计备注（可选）</mat-label>
                          <input matInput formControlName="remark" placeholder="可选：补充说明、参考信息、特殊情况记录" />
                        </mat-form-field>
                      </div>
                      <div *ngIf="selectedAction?.needsEvidence" style="margin:14px 0;padding:12px 14px;background:#fef3c7;border-radius:8px;font-size:12.5px;color:#92400e;line-height:1.7;">
                        <div style="font-weight:600;margin-bottom:4px;">⚠ 证据要求：</div>
                        提交{{ selectedAction.label }}前，需在「附件与证据」Tab上传齐全对应材料。后端会核验「选题申报」「采访安排」「稿件提交」三类证据。
                      </div>
                      <div *ngIf="detail.is_overdue && (selectedAction?.key === 'dispatch' || selectedAction?.key === 'close')" style="margin:14px 0;padding:12px 14px;background:#fee2e2;border-radius:8px;font-size:12.5px;color:#991b1b;line-height:1.7;">
                        <div style="font-weight:600;margin-bottom:4px;">🔴 题单已逾期：</div>
                        {{ detail.overdue_reason }}。逾期题单不能走批量{{ selectedAction.label }}，但在详情页可手动操作（处理意见需说明逾期原因及补正措施），操作后会在审计轨迹留下记录。
                      </div>
                      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;">
                        <button type="button" mat-stroked-button (click)="selectedAction = null;">取消</button>
                        <button type="button" mat-raised-button color="primary" (click)="submitAction()" [disabled]="!selectedAction || processing || !actionForm.valid">
                          {{ processing ? '提交中...' : (selectedAction ? '确认' + selectedAction.label : '请先选择操作') }}
                        </button>
                      </div>
                    </form>
                  </div>
                  <div *ngIf="availableActions.length === 0" style="padding:20px;background:#f3f4f6;border-radius:10px;text-align:center;color:#6b7280;">
                    当前角色/状态下无可执行操作。
                  </div>
                </div>
              </mat-tab>

              <mat-tab label="📎 附件与证据（{{ detail.attachments.length }}）">
                <div style="padding:24px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div>
                      <h4 style="font-size:14px;font-weight:600;margin:0 0 4px;">闭环证据链：选题申报 → 采访安排 → 稿件提交</h4>
                      <div style="font-size:12.5px;color:#6b7280;">
                        当前证据：
                        <span [style.color]="evidenceStatus.declaration ? '#16a34a' : '#dc2626';font-weight:600;margin:0 6px;">选题申报{{ evidenceStatus.declaration ? '✓' : '✗' }}</span>
                        <span [style.color]="evidenceStatus.interview ? '#16a34a' : '#dc2626';font-weight:600;margin:0 6px;">采访安排{{ evidenceStatus.interview ? '✓' : '✗' }}</span>
                        <span [style.color]="evidenceStatus.manuscript ? '#16a34a' : '#dc2626';font-weight:600;margin:0 6px;">稿件提交{{ evidenceStatus.manuscript ? '✓' : '✗' }}</span>
                      </div>
                    </div>
                    <button mat-raised-button color="primary" (click)="openAttachDialog()" [disabled]="!canUploadAny">
                      <mat-icon style="margin-right:4px;">attach_file</mat-icon>上传证据
                    </button>
                  </div>
                  <div *ngIf="detail.attachments.length === 0" style="padding:50px;text-align:center;background:#fafafa;border-radius:10px;color:#9ca3af;">
                    <div style="font-size:40px;margin-bottom:8px;">📎</div>
                    暂无附件材料
                  </div>
                  <table *ngIf="detail.attachments.length > 0" mat-table [dataSource]="detail.attachments" style="width:100%;">
                    <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef style="width:120px;">类型</th>
                      <td mat-cell *matCellDef="let a">
                        <span style="padding:3px 10px;border-radius:14px;font-size:11.5px;font-weight:600;" [style.background]="typeColor(a.attachment_type)+'18'" [style.color]="typeColor(a.attachment_type)">
                          {{ a.attachment_type }}
                        </span>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="file"><th mat-header-cell *matHeaderCellDef>文件</th>
                      <td mat-cell *matCellDef="let a">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <mat-icon style="color:#6b7280;">description</mat-icon>
                          <div>
                            <div style="font-weight:600;font-size:13px;color:#111827;">{{ a.file_name }}</div>
                            <div *ngIf="a.description" style="font-size:11.5px;color:#6b7280;">{{ a.description }}</div>
                          </div>
                        </div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="uploader"><th mat-header-cell *matHeaderCellDef style="width:140px;">上传人</th>
                      <td mat-cell *matCellDef="let a">
                        <div style="font-size:12.5px;">{{ a.uploaded_by_name }}</div>
                        <div style="font-size:11px;color:#9ca3af;">{{ formatDate(a.uploaded_at) }}</div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef style="width:80px;text-align:right;">操作</th>
                      <td mat-cell *matCellDef="let a" style="text-align:right;">
                        <button
                          *ngIf="canDeleteAttachment(a)"
                          mat-icon-button
                          color="warn"
                          (click)="deleteAttachment(a)"
                          matTooltip="删除附件（仅上传人可操作）"
                        ><mat-icon>delete_outline</mat-icon></button>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['type','file','uploader','action']"></tr>
                    <tr mat-row *matRowDef="let r; columns: ['type','file','uploader','action'];"></tr>
                  </table>
                </div>
              </mat-tab>

              <mat-tab label="📜 处理记录（{{ detail.records.length }}）">
                <div style="padding:24px;">
                  <div *ngIf="detail.records.length === 0" style="padding:40px;text-align:center;color:#9ca3af;">暂无处理记录</div>
                  <div *ngFor="let r of detail.records; let i = index" style="display:flex;gap:14px;padding-bottom:20px;position:relative;">
                    <div style="display:flex;flex-direction:column;align-items:center;">
                      <div style="width:34px;height:34px;border-radius:50%;background:#e0e7ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;z-index:2;">{{ i + 1 }}</div>
                      <div *ngIf="i < detail.records.length - 1" style="width:2px;background:#e5e7eb;flex:1;min-height:24px;margin-top:4px;"></div>
                    </div>
                    <div style="flex:1;padding:14px 16px;background:#fafafa;border-radius:10px;position:relative;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span style="font-weight:700;font-size:14px;color:#111827;">{{ r.action }}</span>
                          <span *ngIf="r.from_status || r.to_status" style="font-size:11.5px;color:#6b7280;">
                            <span *ngIf="r.from_status">{{ TOPIC_STATUS_LABEL[r.from_status as keyof typeof TOPIC_STATUS_LABEL] || r.from_status }}</span>
                            <span *ngIf="r.from_status && r.to_status"> → </span>
                            <span *ngIf="r.to_status" [style.color]="TOPIC_STATUS_COLOR[r.to_status as keyof typeof TOPIC_STATUS_COLOR]">{{ TOPIC_STATUS_LABEL[r.to_status as keyof typeof TOPIC_STATUS_LABEL] || r.to_status }}</span>
                          </span>
                        </div>
                        <div style="font-size:11.5px;color:#9ca3af;">v{{ r.version_after }}</div>
                      </div>
                      <div style="font-size:13px;line-height:1.7;color:#1f2937;margin-bottom:6px;">{{ r.opinion }}</div>
                      <div *ngIf="r.remark" style="font-size:12px;color:#6b7280;background:#fffbeb;padding:6px 10px;border-radius:6px;margin-bottom:8px;">📝 审计备注：{{ r.remark }}</div>
                      <div style="font-size:11.5px;color:#9ca3af;display:flex;gap:12px;">
                        <span>{{ r.handler_name }}（{{ ROLE_SHORT_LABEL[r.handler_role as keyof typeof ROLE_SHORT_LABEL] || r.handler_role }}）</span>
                        <span>🕐 {{ formatDate(r.created_at) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </mat-tab>

              <mat-tab label="🔍 审计轨迹（{{ detail.audits.length }}）">
                <div style="padding:24px;">
                  <div *ngIf="detail.audits.length === 0" style="padding:40px;text-align:center;color:#9ca3af;">暂无审计记录</div>
                  <table *ngIf="detail.audits.length > 0" mat-table [dataSource]="detail.audits" style="width:100%;">
                    <ng-container matColumnDef="time"><th mat-header-cell *matHeaderCellDef style="width:160px;">时间</th>
                      <td mat-cell *matCellDef="let a" style="font-size:11.5px;color:#6b7280;">{{ formatDate(a.created_at) }}</td>
                    </ng-container>
                    <ng-container matColumnDef="user"><th mat-header-cell *matHeaderCellDef style="width:160px;">操作人</th>
                      <td mat-cell *matCellDef="let a">
                        <div style="font-size:12.5px;font-weight:600;">{{ a.user_name }}</div>
                        <div style="font-size:11px;color:#9ca3af;">{{ ROLE_SHORT_LABEL[a.user_role as keyof typeof ROLE_SHORT_LABEL] || a.user_role }}</div>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef style="width:120px;">动作</th>
                      <td mat-cell *matCellDef="let a"><span style="font-family:monospace;font-size:11.5px;background:#eef2ff;padding:3px 8px;border-radius:4px;color:#4338ca;">{{ a.action }}</span></td>
                    </ng-container>
                    <ng-container matColumnDef="detail"><th mat-header-cell *matHeaderCellDef>详细信息</th>
                      <td mat-cell *matCellDef="let a" style="font-size:12.5px;color:#374151;line-height:1.6;">{{ a.detail }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['time','user','action','detail']"></tr>
                    <tr mat-row *matRowDef="let r; columns: ['time','user','action','detail'];"></tr>
                  </table>
                </div>
              </mat-tab>
            </mat-tab-group>
          </mat-card>
        </div>

        <div>
          <mat-card style="padding:18px 20px;margin-bottom:16px;">
            <h4 style="font-size:13px;font-weight:600;margin:0 0 14px;color:#374151;">👤 当前操作权限概览</h4>
            <div style="font-size:12.5px;color:#111827;margin-bottom:10px;">当前登录：<b>{{ user?.display_name }}</b></div>
            <div style="font-size:12px;color:#6b7280;line-height:1.7;">
              角色：<b style="color:#111827;">{{ user?.role === 'registrar' ? '登记员' : user?.role === 'auditor' ? '审核主管' : '复核负责人' }}</b><br />
              <span *ngIf="isMyHandler">✓ 你是该题单的当前处理人</span>
              <span *ngIf="isApplicant">✓ 你是该题单的申报人</span>
              <span *ngIf="!isMyHandler && !isApplicant">ℹ 仅可查看，不能直接操作</span>
            </div>
          </mat-card>
          <mat-card style="padding:18px 20px;">
            <h4 style="font-size:13px;font-weight:600;margin:0 0 14px;color:#374151;">⚡ 快捷操作</h4>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button mat-stroked-button routerLink="/topics" style="justify-content:flex-start;"><mat-icon style="margin-right:8px;">list</mat-icon>返回列表</button>
              <button mat-stroked-button (click)="print()" style="justify-content:flex-start;"><mat-icon style="margin-right:8px;">print</mat-icon>打印单据</button>
              <button mat-stroked-button (click)="refresh()" style="justify-content:flex-start;"><mat-icon style="margin-right:8px;">refresh</mat-icon>刷新数据</button>
            </div>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [
    `.overdue-text { color: #dc2626 !important; text-decoration: underline dotted; }`,
  ],
})
export class TopicDetailPageComponent implements OnInit {
  @Input() id!: string;

  loading = true;
  detail: TopicDetailResponse | null = null;
  user = this.auth.currentUser;

  editForm: FormGroup;
  actionForm: FormGroup;
  savingEdit = false;
  processing = false;
  selectedAction: ActionOption | null = null;
  userList: UserInfo[] = [];

  flowStatuses = [
    { key: 'pending_dispatch', label: '待派发', icon: '📋' },
    { key: 'processing', label: '处理中', icon: '⚙️' },
    { key: 'closed', label: '已关闭', icon: '✅' },
    { key: 'archived', label: '已归档', icon: '🗂️' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private topicService: TopicService,
    private auth: AuthService,
    private userService: UserService,
    private snack: MatSnackBar,
    private fb: FormBuilder,
    private dialog: MatDialog
  ) {
    this.editForm = this.fb.group({
      title: [''],
      description: [''],
      source: [''],
      priority: [''],
      category: [''],
    });
    this.actionForm = this.fb.group({
      target_handler_id: [''],
      opinion: ['', [Validators.required]],
      remark: [''],
    });
  }

  ngOnInit() {
    this.auth.user$.subscribe((u) => (this.user = u));
    this.user = this.auth.currentUser;
    this.route.params.subscribe((p) => {
      this.id = p['id'];
      this.load();
    });
    this.userService.list().subscribe({ next: (list) => (this.userList = list) });
  }

  load() {
    this.loading = true;
    this.topicService.detail(this.id).subscribe({
      next: (d) => {
        this.detail = d;
        this.loading = false;
        this.fillEditForm();
        this.selectedAction = null;
        this.actionForm.reset({ target_handler_id: '', opinion: '', remark: '' });
      },
      error: (e: ApiError) => {
        this.loading = false;
        this.snack.open(`加载失败：${e.message}`, '重试', { duration: 5000 }).onAction().subscribe(() => this.load());
      },
    });
  }

  refresh() {
    this.load();
    this.snack.open('已刷新', '好的', { duration: 1500 });
  }

  fillEditForm() {
    if (!this.detail) return;
    const t = this.detail.topic;
    this.editForm.patchValue({
      title: t.title,
      description: t.description,
      source: t.source,
      priority: t.priority,
      category: t.category,
    });
    this.editForm.markAsPristine();
  }

  get canEditBasicInfo(): boolean {
    if (!this.detail || !this.user) return false;
    const t = this.detail.topic;
    if (t.status === 'closed' || t.status === 'archived') return false;
    if (this.user.role === 'registrar') {
      return t.status === 'returned' || t.applicant_id === this.user.id || t.current_handler_id === this.user.id;
    }
    if (this.user.role === 'auditor') {
      return t.current_handler_id === this.user.id;
    }
    return false;
  }

  saveBasic() {
    if (!this.detail || this.editForm.pristine) return;
    this.savingEdit = true;
    const t = this.detail.topic;
    const v = this.editForm.value;
    this.topicService
      .update(this.id, {
        title: v.title !== t.title ? v.title : undefined,
        description: v.description !== t.description ? v.description : undefined,
        source: v.source !== t.source ? v.source : undefined,
        priority: v.priority !== t.priority ? v.priority : undefined,
        category: v.category !== t.category ? v.category : undefined,
        version: t.version,
      })
      .subscribe({
        next: () => {
          this.savingEdit = false;
          this.snack.open('基本信息已更新', '好的', { duration: 2500 });
          this.load();
        },
        error: (e: ApiError) => {
          this.savingEdit = false;
          this.snack.open(`更新失败：${e.message}`, '知道了', { duration: 5000 });
          if (e.code === 'VERSION_CONFLICT') this.load();
        },
      });
  }

  get isApplicant(): boolean {
    return this.detail?.topic.applicant_id === this.user?.id;
  }
  get isMyHandler(): boolean {
    return this.detail?.topic.current_handler_id === this.user?.id;
  }

  statusIndexOf(status: string): number {
    if (status === 'returned') return 0;
    return this.flowStatuses.findIndex((s) => s.key === status);
  }

  priorityLabel(v: string): string {
    return PRIORITY_OPTIONS.find((p) => p.value === v)?.label || v;
  }
  typeColor(t: string): string {
    if (t.includes('选题')) return '#2563eb';
    if (t.includes('采访')) return '#0891b2';
    if (t.includes('稿件')) return '#16a34a';
    return '#9333ea';
  }

  formatDate(s: string | null | undefined): string {
    if (!s) return '—';
    try {
      const d = new Date(s);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return s;
    }
  }
  isPast(s: string | null | undefined): boolean {
    if (!s) return false;
    return new Date(s).getTime() < Date.now();
  }

  get evidenceStatus(): { declaration: boolean; interview: boolean; manuscript: boolean } {
    const atts = this.detail?.attachments || [];
    return {
      declaration: atts.some((a) => a.attachment_type.includes('选题申报')),
      interview: atts.some((a) => a.attachment_type.includes('采访安排')),
      manuscript: atts.some((a) => a.attachment_type.includes('稿件提交')),
    };
  }

  get availableActions(): ActionOption[] {
    if (!this.detail || !this.user) return [];
    const t = this.detail.topic;
    const role = this.user.role;
    const actions: ActionOption[] = [];

    if (t.status === 'pending_dispatch' || t.status === 'returned') {
      if (role === 'auditor') {
        actions.push({ key: 'dispatch', label: '派发领取', icon: '📤', color: '#2563eb', desc: '指定审核主管领取本题单进入处理中' });
      }
      if (role === 'registrar' && t.status === 'returned' && t.current_handler_id === this.user.id) {
        actions.push({ key: 'dispatch', label: '重新提交', icon: '🔁', color: '#2563eb', desc: '补正后重新派发给审核主管', needsHandler: true });
      }
    }
    if (t.status === 'processing' && t.current_handler_id === this.user.id) {
      if (role === 'auditor') {
        actions.push({ key: 'progress', label: '更新进度', icon: '📝', color: '#0ea5e9', desc: '记录进度，不改变状态' });
        actions.push({ key: 'return', label: '退回补正', icon: '↩️', color: '#f59e0b', desc: '退回登记员补充材料' });
        actions.push({
          key: 'submit_review', label: '提交复核', icon: '🔍', color: '#10b981',
          desc: '采访与稿件齐全后提交总编室复核', needsEvidence: true,
        });
      }
      if (role === 'reviewer') {
        actions.push({ key: 'progress', label: '更新进度', icon: '📝', color: '#0ea5e9', desc: '记录复核进度' });
        actions.push({
          key: 'close', label: '关闭题单', icon: '✅', color: '#16a34a',
          desc: '材料齐全、审核通过后关闭（需三类证据齐全）', needsEvidence: true,
        });
        actions.push({ key: 'return', label: '退回补正', icon: '↩️', color: '#f59e0b', desc: '退回处理人补充信息' });
      }
    }
    if (role === 'reviewer') {
      if (t.status === 'closed') {
        actions.push({ key: 'reopen', label: '重开题单', icon: '🔄', color: '#ef4444', desc: '已关闭的题单可重新打开处理' });
        actions.push({ key: 'archive', label: '归档', icon: '🗂️', color: '#6b7280', desc: '最终归档，后续不可操作' });
      }
      if (t.status === 'archived') {
        // no actions
      }
    }

    return actions;
  }

  get nextHandlerOptions(): UserInfo[] {
    if (!this.user) return [];
    if (this.user.role === 'registrar') {
      return this.userList.filter((u) => u.role === 'auditor');
    }
    if (this.user.role === 'auditor') {
      return this.userList.filter((u) => u.role !== 'registrar');
    }
    return this.userList.filter((u) => u.id !== this.user!.id);
  }

  get canUploadAny(): boolean {
    if (!this.user || !this.detail) return false;
    const t = this.detail.topic;
    if (t.status === 'closed' || t.status === 'archived') return false;
    if (this.user.role === 'registrar') {
      return this.isApplicant || this.isMyHandler || t.status === 'returned';
    }
    if (this.user.role === 'auditor') {
      return this.isMyHandler;
    }
    if (this.user.role === 'reviewer') {
      return this.isMyHandler;
    }
    return false;
  }

  canDeleteAttachment(a: Attachment): boolean {
    if (!this.user || !this.detail) return false;
    const t = this.detail.topic;
    if (t.status === 'closed' || t.status === 'archived') return false;
    return a.uploaded_by === this.user.id;
  }

  selectAction(a: ActionOption) {
    this.selectedAction = a;
    if (a.needsHandler && this.nextHandlerOptions.length === 1) {
      this.actionForm.patchValue({ target_handler_id: this.nextHandlerOptions[0].id });
    }
  }

  submitAction() {
    if (!this.selectedAction || !this.detail || this.actionForm.invalid) return;
    const v = this.actionForm.value;
    this.processing = true;
    const req: ProcessTopicRequest = {
      action: this.selectedAction.key as ProcessTopicRequest['action'],
      opinion: v.opinion.trim(),
      remark: v.remark || null,
      target_handler_id: v.target_handler_id || null,
      version: this.detail.topic.version,
    };
    this.topicService.process(this.id, req).subscribe({
      next: (r) => {
        this.processing = false;
        this.snack.open(`${r.action} 成功！新状态：${TOPIC_STATUS_LABEL[r.topic.status as keyof typeof TOPIC_STATUS_LABEL]}`, '好的', { duration: 4000 });
        this.load();
      },
      error: (e: ApiError) => {
        this.processing = false;
        let msg = e.message;
        if (e.code === 'VERSION_CONFLICT') msg += '（请刷新重试）';
        if (e.code === 'VALIDATION_FAILED') msg += '（请补充必要材料）';
        if (e.code === 'STATE_CONFLICT') msg += '（状态已变更，请刷新）';
        if (e.code === 'FORBIDDEN') msg += '（操作越权，请切换角色）';
        this.snack.open(`操作失败：${msg}`, '知道了', { duration: 6000 });
        if (e.code === 'VERSION_CONFLICT' || e.code === 'STATE_CONFLICT') this.load();
      },
    });
  }

  openAttachDialog() {
    const ref = this.dialog.open(AttachDialogComponent, {
      width: '520px',
      data: { user: this.user, canUpload: this.canUploadAny },
      disableClose: true,
    });
    ref.afterClosed().subscribe((res: AttachmentInput | null) => {
      if (!res || !this.detail) return;
      this.topicService.uploadAttachment(this.id, res).subscribe({
        next: () => {
          this.snack.open('附件上传成功', '好的', { duration: 2500 });
          this.load();
        },
        error: (e: ApiError) => this.snack.open(`上传失败：${e.message}`, '知道了', { duration: 5000 }),
      });
    });
  }

  deleteAttachment(a: Attachment) {
    if (!this.detail) return;
    this.topicService.deleteAttachment(this.id, a.id).subscribe({
      next: () => {
        this.snack.open('附件已删除', '好的', { duration: 2500 });
        this.load();
      },
      error: (e: ApiError) => this.snack.open(`删除失败：${e.message}`, '知道了', { duration: 5000 }),
    });
  }

  print() {
    window.print();
  }
}

@Component({
  selector: 'app-attach-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title style="display:flex;align-items:center;gap:8px;margin:0;padding:16px 20px;">
      <mat-icon>attach_file</mat-icon>上传证据材料
    </h2>
    <mat-dialog-content style="padding:8px 20px 16px;">
      <div *ngIf="!data.canUpload" style="padding:14px;background:#fee2e2;border-radius:8px;color:#991b1b;font-size:13px;">当前角色/状态下无权上传附件</div>
      <form *ngIf="data.canUpload" #f="ngForm" (ngSubmit)="ok(f)" style="display:flex;flex-direction:column;gap:14px;">
        <mat-form-field appearance="outline" style="margin:0;">
          <mat-label><span style="color:#ef4444;">*</span> 附件类型</mat-label>
          <mat-select name="attachment_type" [(ngModel)]="form.attachment_type" required>
            <ng-container [ngSwitch]="data.user?.role">
              <ng-container *ngSwitchCase="'registrar'">
                <mat-option value="选题申报">选题申报（申报表、批示、线索）</mat-option>
                <mat-option value="补充证据">补充证据</mat-option>
              </ng-container>
              <ng-container *ngSwitchCase="'auditor'">
                <mat-option value="采访安排">采访安排（行程、联系人、提纲）</mat-option>
                <mat-option value="稿件提交">稿件提交（初稿、成稿、图文资料）</mat-option>
                <mat-option value="补充证据">补充证据</mat-option>
              </ng-container>
              <ng-container *ngSwitchCase="'reviewer'">
                <mat-option value="补充证据">补充证据（复核意见、签字扫描件）</mat-option>
              </ng-container>
            </ng-container>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="margin:0;">
          <mat-label><span style="color:#ef4444;">*</span> 文件名</mat-label>
          <input matInput name="file_name" [(ngModel)]="form.file_name" required placeholder="如：选题申报表-地铁四号线.pdf" />
        </mat-form-field>
        <mat-form-field appearance="outline" style="margin:0;">
          <mat-label><span style="color:#ef4444;">*</span> 文件地址 / 标识</mat-label>
          <input matInput name="file_url" [(ngModel)]="form.file_url" required placeholder="模拟环境：/uploads/xxx.pdf 或 网络URL" />
        </mat-form-field>
        <mat-form-field appearance="outline" style="margin:0;">
          <mat-label>附件说明</mat-label>
          <textarea matInput name="description" [(ngModel)]="form.description" rows="2" placeholder="对本附件用途的简要说明"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions style="padding:12px 20px;display:flex;gap:8px;justify-content:flex-end;">
      <button mat-stroked-button (click)="ref.close(null)">取消</button>
      <button mat-raised-button color="primary" (click)="ok(f)" [disabled]="!form.attachment_type || !form.file_name || !form.file_url">确认上传</button>
    </mat-dialog-actions>
  `,
})
export class AttachDialogComponent {
  form = {
    attachment_type: '',
    file_name: '',
    file_url: '',
    description: '',
  };
  constructor(
    public ref: MatDialogRef<AttachDialogComponent>,
    public data: { user: UserInfo | null; canUpload: boolean }
  ) {}
  ok(f: any) {
    if (!this.form.attachment_type || !this.form.file_name || !this.form.file_url) return;
    const result: AttachmentInput = {
      attachment_type: this.form.attachment_type,
      file_name: this.form.file_name,
      file_url: this.form.file_url,
      description: this.form.description || `附件：${this.form.file_name}`,
    };
    this.ref.close(result);
  }
}
