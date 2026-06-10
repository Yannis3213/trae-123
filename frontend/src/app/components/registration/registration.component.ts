import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { WorkOrderCreateRequest } from '../../models/models';
import { ApiService } from '../../services/api.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-registration',
  template: `
    <div>
      <div *ngIf="showCreateForm" style="background:#fff;padding:24px;border-radius:8px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h4 style="margin:0">📝 新建维修工单</h4>
          <button (click)="showCreateForm = false"
            style="padding:6px 12px;background:#f5f5f5;border:none;border-radius:4px;cursor:pointer">
            ✕ 取消
          </button>
        </div>
        <form [formGroup]="createForm" (ngSubmit)="onCreateSubmit()">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px 30px">
            <div>
              <label style="display:block;margin-bottom:8px;color:#333">预约进厂线索 <span style="color:#ff4d4f">*</span></label>
              <input type="text" formControlName="appointment_clue" placeholder="如: AP20240601001"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px">
            </div>
            <div>
              <label style="display:block;margin-bottom:8px;color:#333">客户姓名 <span style="color:#ff4d4f">*</span></label>
              <input type="text" formControlName="customer_name" placeholder="请输入客户姓名"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px">
            </div>
            <div>
              <label style="display:block;margin-bottom:8px;color:#333">联系电话 <span style="color:#ff4d4f">*</span></label>
              <input type="text" formControlName="phone" placeholder="请输入联系电话"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px">
            </div>
            <div>
              <label style="display:block;margin-bottom:8px;color:#333">车牌号 <span style="color:#ff4d4f">*</span></label>
              <input type="text" formControlName="license_plate" placeholder="如: 京A12345"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px">
            </div>
            <div>
              <label style="display:block;margin-bottom:8px;color:#333">车型 <span style="color:#ff4d4f">*</span></label>
              <input type="text" formControlName="car_model" placeholder="如: 宝马530Li"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px">
            </div>
            <div>
              <label style="display:block;margin-bottom:8px;color:#333">里程数(km) <span style="color:#ff4d4f">*</span></label>
              <input type="number" formControlName="mileage" placeholder="请输入里程数"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px">
            </div>
            <div style="grid-column:span 2">
              <label style="display:block;margin-bottom:8px;color:#333">故障描述 <span style="color:#ff4d4f">*</span></label>
              <textarea formControlName="fault_description" rows="3" placeholder="请详细描述故障情况"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px;resize:vertical"></textarea>
            </div>
            <div>
              <label style="display:block;margin-bottom:8px;color:#333">预计完成时间 <span style="color:#ff4d4f">*</span></label>
              <input type="datetime-local" formControlName="expected_complete_at"
                style="width:100%;padding:10px;border:1px solid #d9d9d9;border-radius:4px">
            </div>
          </div>
          <div style="margin-top:20px;display:flex;gap:15px;justify-content:flex-end">
            <button type="button" (click)="showCreateForm = false"
              style="padding:10px 24px;background:#f5f5f5;border:none;border-radius:4px;cursor:pointer">
              取消
            </button>
            <button type="submit" [disabled]="!createForm.valid || creating"
              style="padding:10px 24px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer">
              {{creating ? '创建中...' : '创建工单'}}
            </button>
          </div>
        </form>
      </div>

      <div *ngIf="!showCreateForm && canCreate" style="margin-bottom:20px">
        <button (click)="showCreateForm = true"
          style="padding:10px 24px;background:#52c41a;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">
          ➕ 新建维修工单
        </button>
      </div>

      <div *ngIf="canCreate" style="background:#fff;padding:20px;border-radius:8px;margin-bottom:20px">
        <div style="font-weight:bold;margin-bottom:10px;color:#1890ff">📋 待补正工单队列</div>
        <div style="font-size:13px;color:#666">退回补正的工单需要您补充资料后重新提交审核</div>
      </div>

      <app-workorder-list
        moduleType="registration"
        defaultStatus="correction">
      </app-workorder-list>
    </div>
  `
})
export class RegistrationComponent {
  showCreateForm = false;
  creating = false;
  createForm: FormGroup;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private fb: FormBuilder
  ) {
    const now = new Date();
    now.setDate(now.getDate() + 3);
    const defaultDate = now.toISOString().slice(0, 16);

    this.createForm = this.fb.group({
      appointment_clue: ['', Validators.required],
      customer_name: ['', Validators.required],
      phone: ['', Validators.required],
      license_plate: ['', Validators.required],
      car_model: ['', Validators.required],
      mileage: [0, [Validators.required, Validators.min(0)]],
      fault_description: ['', Validators.required],
      expected_complete_at: [defaultDate, Validators.required]
    });
  }

  get canCreate(): boolean {
    return this.authService.currentUser?.role === 'registrar';
  }

  onCreateSubmit(): void {
    if (this.createForm.invalid) return;

    this.creating = true;
    const formValue = this.createForm.value;
    const req: WorkOrderCreateRequest = {
      ...formValue,
      expected_complete_at: new Date(formValue.expected_complete_at)
    };

    this.apiService.createWorkOrder(req).subscribe({
      next: () => {
        this.creating = false;
        this.showCreateForm = false;
        this.createForm.reset();
        const now = new Date();
        now.setDate(now.getDate() + 3);
        this.createForm.patchValue({
          expected_complete_at: now.toISOString().slice(0, 16),
          mileage: 0
        });
      },
      error: () => {
        this.creating = false;
      }
    });
  }
}
