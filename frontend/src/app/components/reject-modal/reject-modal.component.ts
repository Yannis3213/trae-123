import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-reject-modal',
  template: `
    <div class="modal-overlay" (click.self)="close.emit(null)">
      <div class="modal" style="width:520px;max-width:92vw">
        <div class="modal-header">
          <span>↩️ 退回补正（计划单：{{planNo}}）</span>
          <button class="modal-close" (click)="close.emit(null)">×</button>
        </div>
        <div class="modal-body">
          <div *ngIf="errorMsg" class="alert alert-error">{{errorMsg}}</div>
          <div class="alert alert-warning">
            ⚠️ 退回后状态将回到「草稿」，当前处理人变更为原责任人，请详细说明退回原因。
          </div>

          <div class="form-item mt-md">
            <label class="form-label required">退回原因</label>
            <textarea class="textarea" rows="5" [(ngModel)]="form.reject_reason"
              placeholder="请详细描述需要补正的内容，例如：1. 客户方验收签字单缺失，请补充上传扫描件；2. 配置检查清单中缺少集成配置验证步骤..."></textarea>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
              至少5个字符，当前：{{form.reject_reason.length}}
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">补充备注（可选）</label>
            <textarea class="textarea" rows="2" [(ngModel)]="form.comment"
              placeholder="其他说明、补充建议等"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" (click)="close.emit(null)">取消</button>
          <button class="btn btn-danger" [disabled]="submitting" (click)="submit()">
            {{submitting ? '退回中...' : '确认退回'}}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class RejectModalComponent {
  @Input() planNo = '';
  @Output() close = new EventEmitter<any>();

  submitting = false;
  errorMsg = '';
  form: any = { reject_reason: '', comment: '' };

  submit() {
    this.errorMsg = '';
    if (!this.form.reject_reason || this.form.reject_reason.length < 5) {
      this.errorMsg = '请填写退回原因（至少5字符）';
      return;
    }
    this.submitting = true;
    this.close.emit({
      reject_reason: this.form.reject_reason.trim(),
      comment: this.form.comment.trim(),
    });
  }
}
