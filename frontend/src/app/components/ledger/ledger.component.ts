import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Statistics, STATUS_LABELS } from '../../models/models';

@Component({
  selector: 'app-ledger',
  template: `
    <div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:15px;margin-bottom:20px">
        <div style="background:#fff;padding:20px;border-radius:8px;text-align:center">
          <div style="font-size:13px;color:#888;margin-bottom:5px">工单总数</div>
          <div style="font-size:24px;font-weight:bold;color:#1890ff">{{statistics?.total_count || 0}}</div>
        </div>
        <div style="background:#fff;padding:20px;border-radius:8px;text-align:center">
          <div style="font-size:13px;color:#888;margin-bottom:5px">待审核</div>
          <div style="font-size:24px;font-weight:bold;color:#fa8c16">{{statistics?.pending_audit || 0}}</div>
        </div>
        <div style="background:#fff;padding:20px;border-radius:8px;text-align:center">
          <div style="font-size:13px;color:#888;margin-bottom:5px">复核中</div>
          <div style="font-size:24px;font-weight:bold;color:#1890ff">{{statistics?.pending_review || 0}}</div>
        </div>
        <div style="background:#fff;padding:20px;border-radius:8px;text-align:center">
          <div style="font-size:13px;color:#888;margin-bottom:5px">待补正</div>
          <div style="font-size:24px;font-weight:bold;color:#ff4d4f">{{statistics?.correction || 0}}</div>
        </div>
        <div style="background:#fff;padding:20px;border-radius:8px;text-align:center">
          <div style="font-size:13px;color:#888;margin-bottom:5px">已办结</div>
          <div style="font-size:24px;font-weight:bold;color:#52c41a">{{statistics?.completed || 0}}</div>
        </div>
      </div>

      <div style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px">
        <div style="font-weight:bold;margin-bottom:10px;color:#1890ff">📊 维修工单台账</div>
        <div style="font-size:13px;color:#666">
          沉淀所有工单处理结果，支持按预约进厂线索筛选，可追踪派修、交车回访核验状态。
        </div>
      </div>

      <app-workorder-list
        moduleType="ledger">
      </app-workorder-list>
    </div>
  `
})
export class LedgerComponent {
  statistics: Statistics | null = null;
  STATUS_LABELS = STATUS_LABELS;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    this.apiService.getStatistics().subscribe(stats => {
      this.statistics = stats;
    });
  }
}
