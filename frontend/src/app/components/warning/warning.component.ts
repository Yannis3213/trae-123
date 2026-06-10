import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Statistics, WARNING_LABELS, WARNING_COLORS } from '../../models/models';

@Component({
  selector: 'app-warning',
  template: `
    <div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:20px">
        <div style="background:#fff;padding:24px;border-radius:8px;border-left:4px solid #52c41a">
          <div style="font-size:13px;color:#888;margin-bottom:8px">正常</div>
          <div style="font-size:28px;font-weight:bold;color:#52c41a">{{statistics?.normal || 0}}</div>
        </div>
        <div style="background:#fff;padding:24px;border-radius:8px;border-left:4px solid #faad14">
          <div style="font-size:13px;color:#888;margin-bottom:8px">临期 (1天内到期)</div>
          <div style="font-size:28px;font-weight:bold;color:#faad14">{{statistics?.near_due || 0}}</div>
        </div>
        <div style="background:#fff;padding:24px;border-radius:8px;border-left:4px solid #ff4d4f">
          <div style="font-size:13px;color:#888;margin-bottom:8px">逾期</div>
          <div style="font-size:28px;font-weight:bold;color:#ff4d4f">{{statistics?.overdue || 0}}</div>
        </div>
      </div>

      <div style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px">
        <div style="font-weight:bold;margin-bottom:10px;color:#1890ff">⚠️ 到期预警队列</div>
        <div style="font-size:13px;color:#666">
          按预警级别排序，优先处理逾期和临期工单。节点超时按责任人计算。
        </div>
      </div>

      <div style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px">
        <div style="display:flex;gap:15px;margin-bottom:15px">
          <button (click)="activeTab = 'overdue'"
            [style.background]="activeTab === 'overdue' ? '#ff4d4f' : '#f5f5f5'"
            [style.color]="activeTab === 'overdue' ? '#fff' : '#333'"
            style="padding:8px 20px;border:none;border-radius:4px;cursor:pointer">
            逾期工单 ({{statistics?.overdue || 0}})
          </button>
          <button (click)="activeTab = 'near_due'"
            [style.background]="activeTab === 'near_due' ? '#faad14' : '#f5f5f5'"
            [style.color]="activeTab === 'near_due' ? '#fff' : '#333'"
            style="padding:8px 20px;border:none;border-radius:4px;cursor:pointer">
            临期工单 ({{statistics?.near_due || 0}})
          </button>
          <button (click)="activeTab = 'normal'"
            [style.background]="activeTab === 'normal' ? '#52c41a' : '#f5f5f5'"
            [style.color]="activeTab === 'normal' ? '#fff' : '#333'"
            style="padding:8px 20px;border:none;border-radius:4px;cursor:pointer">
            正常工单 ({{statistics?.normal || 0}})
          </button>
        </div>
      </div>

      <app-workorder-list
        moduleType="warning"
        [warningFilter]="activeTab">
      </app-workorder-list>
    </div>
  `
})
export class WarningComponent {
  activeTab: 'overdue' | 'near_due' | 'normal' = 'overdue';
  statistics: Statistics | null = null;
  WARNING_LABELS = WARNING_LABELS;
  WARNING_COLORS = WARNING_COLORS;

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
