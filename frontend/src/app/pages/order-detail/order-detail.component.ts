import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService, TransportOrder, Attachment } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-container" *ngIf="order()">
      <div class="page-header">
        <div class="header-left">
          <a [routerLink]="['/orders']" class="back-link">&larr; 返回列表</a>
          <h2 class="page-title">{{ order()?.order_no }}</h2>
          <span class="status-tag" [ngClass]="getStatusClass()">{{ order()?.is_overdue ? '逾期' : '' }}{{ order()?.status }}</span>
          <span class="version-tag">版本 v{{ order()?.version }}</span>
        </div>
        <div class="header-right">
          <span class="priority-{{ order()?.priority === '高' ? 'high' : order()?.priority === '中' ? 'medium' : 'low' }} priority-label">
            优先级：{{ order()?.priority }}
          </span>
        </div>
      </div>

      <div class="alert-bar" *ngIf="order()?.is_overdue">
        <span class="alert-icon">⚠️</span>
        <span>订单已逾期！截止时间：{{ formatDate(order()?.deadline || '') }}。{{ order()?.overdue_reason || '请尽快处理。' }}</span>
      </div>

      <div class="alert-bar alert-info" *ngIf="order()?.exception_reasons?.length">
        <span class="alert-icon">📋</span>
        <span>存在 {{ order()?.exception_reasons?.length }} 条异常记录，请查看下方「异常原因」并处理。</span>
      </div>

      <div class="info-card card">
        <h3 class="section-title">订单概览</h3>
        <div class="info-grid">
          <div class="info-item"><label>责任人</label><span>{{ order()?.responsible_person }}</span></div>
          <div class="info-item"><label>当前处理人</label><span>{{ order()?.current_handler }}</span></div>
          <div class="info-item"><label>截止时间</label><span [class.overdue-text]="order()?.is_overdue">{{ formatDate(order()?.deadline || '') }}</span></div>
          <div class="info-item"><label>创建时间</label><span>{{ formatDate(order()?.created_at || '') }}</span></div>
          <div class="info-item"><label>更新时间</label><span>{{ formatDate(order()?.updated_at || '') }}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="section-header">
          <h3 class="section-title">运输委托</h3>
          <span class="section-tag" *ngIf="canEditConsignment()">可编辑</span>
          <span class="section-tag section-tag-review" *ngIf="canReviewConsignment()">可核验</span>
          <span class="section-tag section-tag-read" *ngIf="!canEditConsignment() && !canReviewConsignment()">只读</span>
          <span class="evidence-status">
            <span [class.ok]="hasEvidence('运输委托单')">✓</span>
            <span [class.miss]="!hasEvidence('运输委托单')">✗</span>
            运输委托单
          </span>
        </div>
        <div class="form-grid" [class.readonly]="!canEditConsignment()">
          <div class="form-item">
            <label>委托方名称</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.consignor_name" />
          </div>
          <div class="form-item">
            <label>委托方联系人</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.consignor_contact" />
          </div>
          <div class="form-item">
            <label>委托方电话</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.consignor_phone" />
          </div>
          <div class="form-item">
            <label>收货方名称</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.consignee_name" />
          </div>
          <div class="form-item">
            <label>收货方联系人</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.consignee_contact" />
          </div>
          <div class="form-item">
            <label>收货方电话</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.consignee_phone" />
          </div>
          <div class="form-item">
            <label>货物名称</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.cargo_name" />
          </div>
          <div class="form-item">
            <label>货物重量</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.cargo_weight" />
          </div>
          <div class="form-item">
            <label>货物体积</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.cargo_volume" />
          </div>
          <div class="form-item">
            <label>货物数量</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.cargo_quantity" />
          </div>
          <div class="form-item">
            <label>起运地</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.departure" />
          </div>
          <div class="form-item">
            <label>目的地</label>
            <input type="text" [disabled]="!canEditConsignment()" [(ngModel)]="form.destination" />
          </div>
          <div class="form-item form-item-full">
            <label>运输要求</label>
            <textarea [disabled]="!canEditConsignment()" [(ngModel)]="form.transport_requirements" rows="2"></textarea>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-header">
          <h3 class="section-title">车辆调度</h3>
          <span class="section-tag" *ngIf="canEditDispatch()">可编辑</span>
          <span class="section-tag section-tag-review" *ngIf="canReviewDispatch()">可核验</span>
          <span class="section-tag section-tag-read" *ngIf="!canEditDispatch() && !canReviewDispatch()">只读</span>
          <span class="evidence-status">
            <span [class.ok]="hasEvidence('车辆调度单')">✓</span>
            <span [class.miss]="!hasEvidence('车辆调度单')">✗</span>
            车辆调度单
          </span>
        </div>
        <div class="form-grid" [class.readonly]="!canEditDispatch()">
          <div class="form-item">
            <label>车牌号</label>
            <input type="text" [disabled]="!canEditDispatch()" [(ngModel)]="form.vehicle_plate" />
          </div>
          <div class="form-item">
            <label>车辆类型</label>
            <input type="text" [disabled]="!canEditDispatch()" [(ngModel)]="form.vehicle_type" />
          </div>
          <div class="form-item">
            <label>司机姓名</label>
            <input type="text" [disabled]="!canEditDispatch()" [(ngModel)]="form.driver_name" />
          </div>
          <div class="form-item">
            <label>司机电话</label>
            <input type="text" [disabled]="!canEditDispatch()" [(ngModel)]="form.driver_phone" />
          </div>
          <div class="form-item">
            <label>派车时间</label>
            <input type="datetime-local" [disabled]="!canEditDispatch()" [(ngModel)]="form.dispatch_time" />
          </div>
          <div class="form-item">
            <label>预计到达</label>
            <input type="datetime-local" [disabled]="!canEditDispatch()" [(ngModel)]="form.estimated_arrival" />
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-header">
          <h3 class="section-title">签收回单</h3>
          <span class="section-tag" *ngIf="canEditReceipt()">可编辑</span>
          <span class="section-tag section-tag-review" *ngIf="canReviewReceipt()">可核验</span>
          <span class="section-tag section-tag-read" *ngIf="!canEditReceipt() && !canReviewReceipt()">只读</span>
          <span class="evidence-status">
            <span [class.ok]="hasEvidence('签收回单')">✓</span>
            <span [class.miss]="!hasEvidence('签收回单')">✗</span>
            签收回单
          </span>
        </div>
        <div class="form-grid" [class.readonly]="!canEditReceipt()">
          <div class="form-item">
            <label>签收人</label>
            <input type="text" [disabled]="!canEditReceipt()" [(ngModel)]="form.receipt_signer" />
          </div>
          <div class="form-item">
            <label>签收时间</label>
            <input type="datetime-local" [disabled]="!canEditReceipt()" [(ngModel)]="form.receipt_time" />
          </div>
          <div class="form-item">
            <label>签收状态</label>
            <select [disabled]="!canEditReceipt()" [(ngModel)]="form.receipt_status">
              <option value="">请选择</option>
              <option value="完好签收">完好签收</option>
              <option value="破损签收">破损签收</option>
              <option value="拒收">拒收</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="form-item form-item-full">
            <label>签收备注</label>
            <textarea [disabled]="!canEditReceipt()" [(ngModel)]="form.receipt_remark" rows="2"></textarea>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title">证据附件</h3>
        <div class="evidence-missing" *ngIf="getMissingEvidence().length > 0 && order()?.status !== '办结'">
          <span class="missing-icon">⚠️</span>
          <span>缺少必要证据：<strong>{{ getMissingEvidence().join('、') }}</strong>，请上传后再提交</span>
        </div>
        <table class="data-table mini">
          <thead>
            <tr>
              <th>文件名</th>
              <th>类型</th>
              <th>上传人</th>
              <th>上传时间</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of order()?.attachments">
              <td>{{ a.file_name }}</td>
              <td>{{ a.file_type }}</td>
              <td>{{ a.uploaded_by }}</td>
              <td>{{ formatDate(a.uploaded_at) }}</td>
              <td>{{ a.description || '-' }}</td>
            </tr>
            <tr *ngIf="!order()?.attachments?.length">
              <td colspan="5" class="empty-cell">暂无附件</td>
            </tr>
          </tbody>
        </table>
        <div class="add-evidence" *ngIf="canAddEvidence()">
          <h4>上传新证据（模拟）</h4>
          <div class="evidence-form">
            <input type="text" placeholder="文件名" [(ngModel)]="newEvidence.file_name" />
            <select [(ngModel)]="newEvidence.file_type">
              <option value="运输委托单">运输委托单</option>
              <option value="车辆调度单">车辆调度单</option>
              <option value="签收回单">签收回单</option>
              <option value="其他">其他</option>
            </select>
            <input type="text" placeholder="说明（可选）" [(ngModel)]="newEvidence.description" />
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title">处理记录</h3>
        <div class="timeline">
          <div class="timeline-item" *ngFor="let r of order()?.processing_records">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-action">{{ r.action }}</span>
                <span class="timeline-operator">{{ r.operator }} ({{ r.operator_role }})</span>
                <span class="timeline-time">{{ formatDate(r.created_at) }}</span>
              </div>
              <div class="timeline-status" *ngIf="r.previous_status || r.new_status">
                {{ r.previous_status || '新建' }} → {{ r.new_status }}
              </div>
              <div class="timeline-remark" *ngIf="r.remark">备注：{{ r.remark }}</div>
              <div class="timeline-evidence" *ngIf="r.evidence_summary">证据：{{ r.evidence_summary }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" *ngIf="order()?.exception_reasons?.length">
        <h3 class="section-title">异常原因</h3>
        <div class="exception-list">
          <div class="exception-item" *ngFor="let e of order()?.exception_reasons">
            <div class="exception-head">
              <span class="exception-category cat-{{ getCategoryClass(e.category) }}">{{ e.category }}</span>
              <span class="exception-reporter">{{ e.reported_by }}</span>
              <span class="exception-time">{{ formatDate(e.reported_at) }}</span>
              <span class="exception-handler" *ngIf="e.node_handler">节点责任人：{{ e.node_handler }}</span>
              <span class="exception-status" [class.resolved]="e.resolved">
                {{ e.resolved ? '已处理' : '待处理' }}
              </span>
            </div>
            <div class="exception-reason">{{ e.reason }}</div>
            <div class="exception-resolution" *ngIf="e.resolved && e.resolution_note">
              处理说明：{{ e.resolution_note }}
            </div>
          </div>
        </div>
      </div>

      <div class="action-card card">
        <div class="action-left">
          <div class="form-item action-item">
            <label>处理备注</label>
            <textarea [(ngModel)]="actionRemark" rows="2" placeholder="请输入处理说明（可选）"></textarea>
          </div>
        </div>
        <div class="action-right">
          <button class="btn" (click)="saveDraft()" [disabled]="!canEdit()" *ngIf="canEdit()">保存修改</button>
          <button class="btn" (click)="doAction('核验')" *ngIf="canReview()">仅核验</button>
          <button class="btn btn-danger" (click)="doAction('退回补正')" *ngIf="canReject()">退回补正</button>
          <button class="btn btn-primary" (click)="doAction('通过')" *ngIf="canApprove()">
            {{ submitButtonText() }}
          </button>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="showErrorModal" (click.self)="showErrorModal = false">
        <div class="modal-card">
          <div class="modal-header">
            <h3>操作失败</h3>
            <button class="btn-close" (click)="showErrorModal = false">&times;</button>
          </div>
          <div class="modal-body">
            <div class="error-detail">
              <div class="error-category" [class]="errorCategory">
                {{ errorType }}
              </div>
              <div class="error-message">{{ errorMessage }}</div>
            </div>
            <div class="error-suggestion">
              <strong>建议处理：</strong>
              <p>{{ errorSuggestion }}</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" (click)="showErrorModal = false">知道了</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1200px; margin: 0 auto; }
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; padding: 16px 20px; background: #fff; border-radius: 6px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .back-link { color: #1677ff; text-decoration: none; font-size: 14px; }
    .back-link:hover { text-decoration: underline; }
    .page-title { font-size: 20px; font-weight: 600; margin: 0; }
    .version-tag { font-size: 12px; color: #666; background: #f5f5f5; padding: 2px 8px; border-radius: 4px; }
    .priority-label { font-size: 14px; }
    .card { background: #fff; border-radius: 6px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
    .section-title { font-size: 15px; font-weight: 600; margin: 0 0 16px; color: #1f1f1f; }
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    .section-header .section-title { margin-bottom: 0; }
    .section-tag { font-size: 12px; padding: 2px 8px; background: #e6f4ff; color: #1677ff; border-radius: 4px; }
    .section-tag-review { background: #fff7e6; color: #d46b08; }
    .section-tag-read { background: #f5f5f5; color: #8c8c8c; }
    .evidence-status { margin-left: auto; font-size: 13px; color: #666; display: flex; align-items: center; gap: 4px; }
    .evidence-status .ok { color: #389e0d; font-weight: bold; }
    .evidence-status .miss { color: #cf1322; font-weight: bold; }
    .evidence-missing {
      padding: 10px 14px; background: #fff1f0; color: #cf1322;
      border-radius: 4px; margin-bottom: 12px; font-size: 13px;
      border: 1px solid #ffa39e;
    }
    .evidence-missing .missing-icon { margin-right: 6px; }
    .evidence-missing strong { font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .info-item label { display: block; font-size: 12px; color: #8c8c8c; margin-bottom: 4px; }
    .info-item span { font-size: 14px; color: #1f1f1f; font-weight: 500; }
    .overdue-text { color: #cf1322; font-weight: 600; }
    .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 16px; }
    .form-grid.readonly input, .form-grid.readonly select, .form-grid.readonly textarea {
      background: #fafafa; color: #595959; cursor: not-allowed;
    }
    .form-item label { display: block; font-size: 12px; color: #595959; margin-bottom: 4px; }
    .form-item input, .form-item select, .form-item textarea {
      width: 100%; padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;
    }
    .form-item input:disabled, .form-item select:disabled, .form-item textarea:disabled { background: #fafafa; }
    .form-item-full { grid-column: 1 / -1; }
    .alert-bar {
      padding: 12px 16px; background: #fff1f0; color: #cf1322;
      border-radius: 4px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px;
      border: 1px solid #ffa39e;
    }
    .alert-bar.alert-info { background: #e6f4ff; color: #0958d9; border-color: #91caff; }
    .alert-icon { font-size: 16px; }
    .data-table.mini th, .data-table.mini td { padding: 8px 10px; font-size: 13px; }
    .empty-cell { text-align: center; color: #999; padding: 20px !important; }
    .add-evidence { margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0; }
    .add-evidence h4 { font-size: 13px; margin: 0 0 12px; color: #333; }
    .evidence-form { display: flex; gap: 10px; }
    .evidence-form input, .evidence-form select {
      padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; flex: 1;
    }
    .timeline { padding-left: 8px; }
    .timeline-item { position: relative; padding: 0 0 20px 24px; border-left: 2px solid #f0f0f0; }
    .timeline-item:last-child { border-left-color: transparent; padding-bottom: 0; }
    .timeline-dot {
      position: absolute; left: -7px; top: 4px; width: 12px; height: 12px;
      border-radius: 50%; background: #1677ff; border: 2px solid #fff;
    }
    .timeline-header { display: flex; gap: 12px; align-items: center; font-size: 13px; margin-bottom: 4px; }
    .timeline-action { font-weight: 600; color: #1677ff; }
    .timeline-operator { color: #595959; }
    .timeline-time { color: #8c8c8c; font-size: 12px; margin-left: auto; }
    .timeline-status { font-size: 12px; color: #8c8c8c; margin-bottom: 4px; }
    .timeline-remark, .timeline-evidence { font-size: 13px; color: #595959; margin-top: 2px; }
    .exception-item {
      padding: 12px 16px; background: #fafafa; border-radius: 4px; margin-bottom: 10px; border-left: 3px solid #ff4d4f;
    }
    .exception-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .exception-category { font-size: 12px; padding: 2px 8px; border-radius: 4px; color: #fff; font-weight: 500; }
    .cat-material { background: #d46b08; }
    .cat-permission { background: #722ed1; }
    .cat-deadline { background: #cf1322; }
    .cat-status { background: #0958d9; }
    .exception-reporter { font-size: 13px; color: #595959; }
    .exception-time { font-size: 12px; color: #8c8c8c; margin-left: auto; }
    .exception-handler { font-size: 12px; color: #1677ff; margin-left: 12px; }
    .exception-status {
      font-size: 12px; padding: 2px 8px; background: #fff1f0; color: #cf1322; border-radius: 4px;
    }
    .exception-status.resolved { background: #f6ffed; color: #389e0d; }
    .exception-reason { font-size: 13px; color: #1f1f1f; }
    .exception-resolution { margin-top: 6px; font-size: 12px; color: #389e0d; }
    .action-card { display: flex; gap: 24px; align-items: flex-start; }
    .action-left { flex: 1; }
    .action-item { margin-bottom: 0; }
    .action-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .btn {
      padding: 8px 18px; border: 1px solid #d9d9d9; background: #fff; border-radius: 4px; font-size: 13px; cursor: pointer;
    }
    .btn:hover { border-color: #1677ff; color: #1677ff; }
    .btn-primary { background: #1677ff; color: #fff; border-color: #1677ff; }
    .btn-primary:hover { background: #4096ff; color: #fff; border-color: #4096ff; }
    .btn-primary:disabled { background: #91caff; cursor: not-allowed; color: #fff; border-color: #91caff; }
    .btn-danger { background: #fff; color: #ff4d4f; border-color: #ff4d4f; }
    .btn-danger:hover { background: #ff4d4f; color: #fff; }
    .btn:disabled { cursor: not-allowed; opacity: 0.6; }
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-card { background: #fff; border-radius: 8px; width: 90%; max-width: 480px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
    .modal-header h3 { font-size: 16px; font-weight: 600; }
    .btn-close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; line-height: 1; }
    .modal-body { padding: 20px; }
    .modal-footer { padding: 12px 20px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; }
    .error-detail { padding: 12px 16px; border-radius: 4px; background: #fff1f0; border-left: 3px solid #ff4d4f; }
    .error-category { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    .error-category.cat-material { color: #d46b08; }
    .error-category.cat-permission { color: #722ed1; }
    .error-category.cat-deadline { color: #cf1322; }
    .error-category.cat-status { color: #0958d9; }
    .error-message { font-size: 14px; color: #1f1f1f; }
    .error-suggestion { margin-top: 12px; font-size: 13px; color: #595959; }
    .error-suggestion strong { color: #1f1f1f; }
    .error-suggestion p { margin: 4px 0 0; line-height: 1.6; }
  `]
})
export class OrderDetailComponent implements OnInit {
  order = signal<TransportOrder | null>(null);
  form: any = {};
  newEvidence: Partial<Attachment> = { file_name: '', file_type: '运输委托单', description: '' };
  actionRemark = '';
  loading = signal(false);
  showErrorModal = false;
  errorMessage = '';
  errorType = '';
  errorCategory = '';
  errorSuggestion = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(p => {
      const id = Number(p['id']);
      if (id) this.loadOrder(id);
    });
  }

  loadOrder(id: number) {
    this.orderService.getOrder(id).subscribe({
      next: o => {
        this.order.set(o);
        this.form = {
          consignor_name: o.consignor_name,
          consignor_contact: o.consignor_contact,
          consignor_phone: o.consignor_phone,
          consignee_name: o.consignee_name,
          consignee_contact: o.consignee_contact,
          consignee_phone: o.consignee_phone,
          cargo_name: o.cargo_name,
          cargo_weight: o.cargo_weight,
          cargo_volume: o.cargo_volume,
          cargo_quantity: o.cargo_quantity,
          departure: o.departure,
          destination: o.destination,
          transport_requirements: o.transport_requirements,
          vehicle_plate: o.vehicle_plate,
          vehicle_type: o.vehicle_type,
          driver_name: o.driver_name,
          driver_phone: o.driver_phone,
          dispatch_time: this.toLocal(o.dispatch_time),
          estimated_arrival: this.toLocal(o.estimated_arrival),
          receipt_signer: o.receipt_signer,
          receipt_time: this.toLocal(o.receipt_time),
          receipt_status: o.receipt_status,
          receipt_remark: o.receipt_remark,
          priority: o.priority,
          responsible_person: o.responsible_person,
          deadline: this.toLocal(o.deadline),
        };
      },
      error: err => alert('加载订单失败：' + (err?.error?.detail || err?.message)),
    });
  }

  private toLocal(s?: string): string {
    if (!s) return '';
    try {
      const d = new Date(s);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ''; }
  }

  private fromLocal(s?: string): string | undefined {
    if (!s) return undefined;
    try { return new Date(s).toISOString(); } catch { return undefined; }
  }

  formatDate(s: string) {
    try { return new Date(s).toLocaleString('zh-CN'); } catch { return s; }
  }

  getStatusClass(): string {
    if (this.order()?.is_overdue) return 'status-overdue';
    switch (this.order()?.status) {
      case '待补正': return 'status-pending';
      case '复核中': return 'status-reviewing';
      case '办结': return 'status-completed';
      default: return '';
    }
  }

  getCategoryClass(c: string) {
    switch (c) {
      case '材料问题': return 'material';
      case '权限问题': return 'permission';
      case '时限问题': return 'deadline';
      case '状态问题': return 'status';
      default: return 'status';
    }
  }

  hasEvidence(type: string): boolean {
    return !!this.order()?.attachments?.some(a => a.file_type === type);
  }

  canEdit(): boolean {
    const status = this.order()?.status;
    const role = this.authService.currentUser()?.role;
    const handler = this.order()?.current_handler;
    const me = this.authService.currentUser()?.full_name;
    if (status === '办结') return false;
    if (handler !== me) return false;
    if (status === '待补正' && role === '客服专员') return true;
    if (status === '复核中' && role === '调度主管') return true;
    return false;
  }

  canEditConsignment() {
    return this.canEdit() && this.order()?.status === '待补正' && this.authService.isCustomerService();
  }
  canReviewConsignment() {
    const status = this.order()?.status;
    const handler = this.order()?.current_handler;
    const me = this.authService.currentUser()?.full_name;
    return status === '复核中' && handler === me && (this.authService.isDispatchSupervisor() || this.authService.isOperationsManager());
  }
  canEditDispatch() {
    return this.canEdit() && this.order()?.status === '复核中' && this.authService.isDispatchSupervisor();
  }
  canReviewDispatch() {
    const status = this.order()?.status;
    const handler = this.order()?.current_handler;
    const me = this.authService.currentUser()?.full_name;
    return status === '复核中' && handler === me && this.authService.isOperationsManager();
  }
  canEditReceipt() {
    return this.canEdit() && this.order()?.status === '复核中' && this.authService.isDispatchSupervisor();
  }
  canReviewReceipt() {
    const handler = this.order()?.current_handler;
    const me = this.authService.currentUser()?.full_name;
    return handler === me && this.authService.isOperationsManager();
  }
  canAddEvidence() {
    return this.canEdit() || this.canApprove();
  }
  canReview() {
    const status = this.order()?.status;
    const handler = this.order()?.current_handler;
    const me = this.authService.currentUser()?.full_name;
    if (status === '办结') return false;
    return handler === me;
  }
  canReject() {
    const status = this.order()?.status;
    const role = this.authService.currentUser()?.role;
    const handler = this.order()?.current_handler;
    const me = this.authService.currentUser()?.full_name;
    if (status === '办结') return false;
    if (handler !== me) return false;
    if (status === '复核中' && (role === '调度主管' || role === '运营经理')) return true;
    return false;
  }
  canApprove() {
    const status = this.order()?.status;
    const handler = this.order()?.current_handler;
    const me = this.authService.currentUser()?.full_name;
    if (status === '办结') return false;
    if (handler !== me) return false;
    const role = this.authService.currentUser()?.role;
    if (status === '待补正' && role === '客服专员') return true;
    if (status === '复核中' && (role === '调度主管' || role === '运营经理')) return true;
    return false;
  }

  getRequiredEvidence(): string[] {
    const status = this.order()?.status;
    if (status === '待补正') return ['运输委托单'];
    if (status === '复核中') return ['车辆调度单', '签收回单'];
    return [];
  }

  getMissingEvidence(): string[] {
    const required = this.getRequiredEvidence();
    const existing = new Set(this.order()?.attachments?.map(a => a.file_type) || []);
    return required.filter(r => !existing.has(r) && r !== this.newEvidence.file_type);
  }

  submitButtonText() {
    switch (this.order()?.status) {
      case '待补正': return '提交至复核';
      case '复核中': return '提交至办结归档';
      default: return '通过';
    }
  }

  saveDraft() {
    if (!this.order()) return;
    this.loading.set(true);
    const payload: any = {};
    Object.keys(this.form).forEach(k => {
      if (['dispatch_time', 'estimated_arrival', 'receipt_time', 'deadline'].includes(k)) {
        payload[k] = this.fromLocal(this.form[k]);
      } else {
        payload[k] = this.form[k];
      }
    });
    this.orderService.updateOrder(this.order()!.id, payload).subscribe({
      next: o => {
        this.loading.set(false);
        this.order.set(o);
        alert('保存成功');
      },
      error: err => {
        this.loading.set(false);
        this.handleError(err);
      }
    });
  }

  doAction(action: string) {
    if (!this.order()) return;

    if (action !== '核验') {
      const missing = this.getMissingEvidence();
      if (this.newEvidence.file_name && this.newEvidence.file_type) {
        const idx = missing.indexOf(this.newEvidence.file_type);
        if (idx >= 0) missing.splice(idx, 1);
      }
      if (action !== '退回补正' && missing.length > 0) {
        alert(`材料校验不通过，仍缺少：${missing.join('、')}。请上传后再提交。`);
        return;
      }
      if (action === '退回补正' && !this.actionRemark.trim()) {
        alert('退回补正必须填写原因说明');
        return;
      }
    }

    this.loading.set(true);
    const evidence_files: any[] = [];
    if (this.newEvidence.file_name && this.newEvidence.file_type) {
      evidence_files.push({
        file_name: this.newEvidence.file_name,
        file_type: this.newEvidence.file_type,
        description: this.newEvidence.description,
      });
    }
    this.orderService.processOrder(this.order()!.id, {
      action,
      remark: this.actionRemark,
      evidence_files: evidence_files.length ? evidence_files : undefined,
      expected_version: this.order()!.version,
    }).subscribe({
      next: o => {
        this.loading.set(false);
        this.order.set(o);
        this.actionRemark = '';
        this.newEvidence = { file_name: '', file_type: '运输委托单', description: '' };
        alert(`操作成功，当前状态：${o.status}`);
      },
      error: err => {
        this.loading.set(false);
        this.handleError(err);
      }
    });
  }

  handleError(err: any) {
    const msg = err?.error?.detail || err?.error?.message || err?.message || '未知错误';
    this.errorMessage = msg;
    if (msg.includes('材料')) {
      this.errorType = '材料问题';
      this.errorCategory = 'cat-material';
      this.errorSuggestion = '请补充上传缺失的证据附件（运输委托单/车辆调度单/签收回单），或核对委托信息的完整性后重新提交。';
    } else if (msg.includes('权限')) {
      this.errorType = '权限问题';
      this.errorCategory = 'cat-permission';
      this.errorSuggestion = '请使用对应岗位账号登录，或联系管理员将订单处理人变更为当前账号。';
    } else if (msg.includes('时限') || msg.includes('逾期')) {
      this.errorType = '时限问题';
      this.errorCategory = 'cat-deadline';
      this.errorSuggestion = '请尽快补正材料并提交，同时在异常原因中说明逾期原因，必要时联系运营经理说明情况。';
    } else if (msg.includes('状态') || msg.includes('版本')) {
      this.errorType = '状态问题';
      this.errorCategory = 'cat-status';
      this.errorSuggestion = '请刷新页面获取最新订单状态和版本号后再操作，避免重复提交或状态冲突。';
    } else {
      this.errorType = '操作错误';
      this.errorCategory = 'cat-status';
      this.errorSuggestion = '请刷新页面后重试，如问题持续存在请联系管理员。';
    }
    this.showErrorModal = true;
  }
}
