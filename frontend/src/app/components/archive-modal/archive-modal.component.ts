import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-archive-modal',
  template: `
    <div class="modal-overlay" (click.self)="close.emit(null)">
      <div class="modal" style="width:560px;max-width:92vw">
        <div class="modal-header">
          <span>✅ 归档收口（计划单：{{planNo}}）</span>
          <button class="modal-close" (click)="close.emit(null)">×</button>
        </div>
        <div class="modal-body">
          <div *ngIf="errorMsg" class="alert alert-error">{{errorMsg}}</div>
          <div class="alert alert-success">
            🎉 归档后本单完成闭环，所有数据将封存不可修改。请确认验收材料完整。
          </div>

          <div class="form-item mt-md">
            <label class="form-label required">处理结果</label>
            <textarea class="textarea" rows="4" [(ngModel)]="form.result"
              placeholder="请总结本次上线的处理结果，例如：客户验收通过，系统已在生产环境稳定运行7天，无P0/P1问题，SLA达标，客户满意度良好..."></textarea>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
              至少5个字符，当前：{{form.result.length}}
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">🔍 审计备注</label>
            <textarea class="textarea" rows="3" [(ngModel)]="form.audit_note"
              placeholder="审计侧复核意见、特殊说明等，将永久保存在审计备注中，例如：已核查合同编号、验收单扫描件、UAT测试报告，符合归档标准"></textarea>
          </div>

          <div class="form-item">
            <label class="form-label">证据说明（可选）</label>
            <input class="input" [(ngModel)]="form.evidence"
              placeholder="例如：验收单、测试报告、客户签字截图等">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" (click)="close.emit(null)">取消</button>
          <button class="btn btn-success" [disabled]="submitting" (click)="submit()">
            {{submitting ? '归档中...' : '确认归档'}}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ArchiveModalComponent {
  @Input() planNo = '';
  @Output() close = new EventEmitter<any>();

  submitting = false;
  errorMsg = '';
  form: any = { result: '', audit_note: '', evidence: '' };

  submit() {
    this.errorMsg = '';
    if (!this.form.result || this.form.result.length < 5) {
      this.errorMsg = '请填写处理结果（至少5字符）';
      return;
    }
    this.submitting = true;
    this.close.emit({
      result: this.form.result.trim(),
      audit_note: this.form.audit_note.trim(),
      evidence: this.form.evidence.trim(),
    });
  }
}
