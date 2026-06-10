import { Component } from '@angular/core';

@Component({
  selector: 'app-verification',
  template: `
    <div>
      <div style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px">
        <div style="font-weight:bold;margin-bottom:10px;color:#fa8c16">✅ 过程核验工作台</div>
        <div style="font-size:13px;color:#666">
          审核维修登记员提交的工单，核验检测报告、报价单、配件确认单等证据。
          可批量审核通过或退回补正。
        </div>
      </div>

      <app-workorder-list
        moduleType="verification"
        defaultStatus="pending_audit">
      </app-workorder-list>
    </div>
  `
})
export class VerificationComponent {}
