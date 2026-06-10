import { Component } from '@angular/core';

@Component({
  selector: 'app-review',
  template: `
    <div>
      <div style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px">
        <div style="font-weight:bold;margin-bottom:10px;color:#1890ff">📋 复核归档工作台</div>
        <div style="font-size:13px;color:#666">
          最终复核维修工单，核验终检报告、派修单、客户确认单等证据。
          可批量归档办结或退回补正。
        </div>
      </div>

      <app-workorder-list
        moduleType="review"
        defaultStatus="pending_review">
      </app-workorder-list>
    </div>
  `
})
export class ReviewComponent {}
