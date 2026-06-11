import { Component, Input } from '@angular/core';
import { ProcessRecord, AuditNote, ExceptionLog } from '../../models/launch-plan';

@Component({
  selector: 'app-audit-timeline',
  inputs: ['processRecords', 'auditNotes', 'exceptionLogs'],
  template: `
    <div class="audit-tabs">
      <div class="tab-bar">
        <button class="tab-btn" [class.active]="activeTab === 'process'"
          (click)="activeTab = 'process'">
          🔄 处理记录（{{processRecords.length}}）
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'audit'"
          (click)="activeTab = 'audit'">
          📝 审计备注（{{auditNotes.length}}）
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'exception'"
          (click)="activeTab = 'exception'">
          ⚠️ 异常日志（{{exceptionLogs.length}}）
        </button>
      </div>

      <div class="tab-body" [ngSwitch]="activeTab">
        <div *ngSwitchCase="'process'">
          <div *ngIf="processRecords.length === 0" class="empty">暂无处理记录</div>
          <div class="timeline" *ngIf="processRecords.length > 0">
            <div *ngFor="let r of processRecords" class="timeline-item">
              <div class="timeline-time">
                {{r.created_at}} ·
                <strong>{{r.operator}}</strong>
                <span class="tag tag-info" style="margin-left:6px">{{r.operator_role_name}}</span>
              </div>
              <div class="timeline-title">
                <span class="action-chip">{{actionLabel(r.action)}}</span>
                <span *ngIf="r.from_status" class="status-chip">{{r.from_status_name}}</span>
                <span *ngIf="r.from_status">→</span>
                <span class="status-chip active">{{r.to_status_name}}</span>
              </div>
              <div class="timeline-content" *ngIf="r.comment">
                💬 {{r.comment}}
              </div>
              <div class="timeline-content mt-sm" *ngIf="r.evidence" style="background:#fff7ed;border-color:#fdba74">
                📎 证据：{{r.evidence}}
              </div>
            </div>
          </div>
        </div>

        <div *ngSwitchCase="'audit'">
          <div *ngIf="auditNotes.length === 0" class="empty">暂无审计备注</div>
          <div class="timeline" *ngIf="auditNotes.length > 0">
            <div *ngFor="let a of auditNotes" class="timeline-item">
              <div class="timeline-time">
                {{a.created_at}} ·
                <strong>{{a.author}}</strong>
                <span class="tag tag-success" style="margin-left:6px">{{a.author_role_name}}</span>
              </div>
              <div class="timeline-title">审计备注</div>
              <div class="timeline-content" style="background:#ecfdf5;border-color:#6ee7b7">
                {{a.note}}
              </div>
            </div>
          </div>
        </div>

        <div *ngSwitchCase="'exception'">
          <div *ngIf="exceptionLogs.length === 0" class="empty">暂无异常日志（异常日志仅作为证据，详情请以处理记录为准）</div>
          <table class="data-table" *ngIf="exceptionLogs.length > 0">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>详情</th>
                <th>操作人</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of exceptionLogs">
                <td style="white-space:nowrap">{{e.created_at}}</td>
                <td><span class="tag tag-danger">{{exceptionTypeLabel(e.type)}}</span></td>
                <td style="max-width:400px">{{e.detail}}</td>
                <td>{{e.operator || '-'}}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tab-bar {
      display: flex;
      gap: 0;
      border-bottom: 2px solid var(--border);
      margin-bottom: 16px;
    }
    .tab-btn {
      padding: 10px 20px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
    }
    .tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
      font-weight: 600;
    }
    .action-chip {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      margin-right: 8px;
    }
    .status-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      background: #f4f4f5;
      color: #71717a;
      font-size: 12px;
      margin: 0 2px;
    }
    .status-chip.active {
      background: var(--bg-hover);
      color: var(--primary);
    }
    .empty {
      padding: 40px;
      text-align: center;
      color: var(--text-secondary);
      background: var(--bg-light);
      border-radius: 6px;
    }
    .data-table th, .data-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .data-table th { background: var(--bg-light); }
  `],
})
export class AuditTimelineComponent {
  @Input() processRecords: ProcessRecord[] = [];
  @Input() auditNotes: AuditNote[] = [];
  @Input() exceptionLogs: ExceptionLog[] = [];

  activeTab: 'process' | 'audit' | 'exception' = 'process';

  actionLabel(a: string) {
    const map: Record<string, string> = {
      create: '🆕 创建',
      update: '✏️ 更新',
      submit: '📤 提交复核',
      reject: '↩️ 退回补正',
      archive: '✅ 归档',
      overdue_blocked: '🚫 逾期拦截',
      assign: '🔄 指派交付顾问',
      accept: '✋ 接办',
      blocked: '⛔ 批量拦截',
      missing_evidence: '📋 材料缺失',
    };
    return map[a] || a;
  }

  exceptionTypeLabel(t: string) {
    const map: Record<string, string> = {
      version_conflict: '版本冲突',
      missing_evidence: '证据缺失',
      overdue_blocked: '逾期拦截',
      auth_violation: '越权访问',
      duplicate_submit: '重复提交',
    };
    return map[t] || t;
  }
}
