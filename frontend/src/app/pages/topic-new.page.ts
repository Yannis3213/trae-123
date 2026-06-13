import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TopicService } from '../services/api.service';
import { PRIORITY_OPTIONS, CATEGORY_OPTIONS, ApiError, CreateTopicRequest } from '../models';

@Component({
  selector: 'app-topic-new',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
  ],
  template: `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <button mat-icon-button routerLink="/topics" style="margin-right:8px;"><mat-icon>arrow_back</mat-icon></button>
          <span style="font-size:24px;font-weight:700;color:#111827;">📝 新建选题申报</span>
        </div>
        <div style="font-size:13px;color:#6b7280;background:#eef2ff;padding:6px 12px;border-radius:8px;">
          登记员角色发起：选题名称、描述、来源、分类、优先级、截止时间
        </div>
      </div>
      <mat-card style="padding:24px 28px;max-width:860px;">
        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" style="width:100%;margin-bottom:16px;">
            <mat-label><span style="color:#ef4444;">*</span> 选题名称</mat-label>
            <input matInput formControlName="title" placeholder="如：2024年度经济发展成就回顾" />
            <mat-hint align="end">{{ form.get('title')?.value?.length || 0 }}/120</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline" style="width:100%;margin-bottom:16px;">
            <mat-label><span style="color:#ef4444;">*</span> 选题描述</mat-label>
            <textarea matInput formControlName="description" rows="4" placeholder="请详细描述选题背景、报道角度、预期产出等"></textarea>
            <mat-hint align="end">{{ form.get('description')?.value?.length || 0 }}/2000</mat-hint>
          </mat-form-field>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">
            <mat-form-field appearance="outline">
              <mat-label><span style="color:#ef4444;">*</span> 选题来源</mat-label>
              <input matInput formControlName="source" placeholder="如：市政宣传部 / 发改委 / 热线线索" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label><span style="color:#ef4444;">*</span> 优先级</mat-label>
              <mat-select formControlName="priority">
                <mat-option *ngFor="let p of PRIORITY_OPTIONS" [value]="p.value">{{ p.label }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label><span style="color:#ef4444;">*</span> 报道分类</mat-label>
              <mat-select formControlName="category">
                <mat-option *ngFor="let c of CATEGORY_OPTIONS" [value]="c">{{ c }}</mat-option>
              </mat-select>
            </mat-form-field>
            <div></div>
            <mat-form-field appearance="outline">
              <mat-label>采访安排截止时间</mat-label>
              <input matInput [matDatepicker]="dp1" formControlName="interview_deadline" />
              <mat-datepicker-toggle matSuffix [for]="dp1"></mat-datepicker-toggle>
              <mat-datepicker #dp1></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>稿件提交截止时间</mat-label>
              <input matInput [matDatepicker]="dp2" formControlName="submission_deadline" />
              <mat-datepicker-toggle matSuffix [for]="dp2"></mat-datepicker-toggle>
              <mat-datepicker #dp2></mat-datepicker>
            </mat-form-field>
          </div>
          <div style="margin-top:24px;padding:14px 16px;background:#eff6ff;border-radius:8px;font-size:12.5px;color:#1e40af;line-height:1.7;">
            <div style="font-weight:600;margin-bottom:4px;">📌 申报后流程：</div>
            1. 提交后状态为「待派发」，责任编辑可领取派发；<br />
            2. 派发后进入「处理中」，责任编辑上传采访安排与稿件；<br />
            3. 材料齐全后提交复核，总编室关闭归档。
          </div>
          <div style="margin-top:24px;display:flex;gap:12px;justify-content:flex-end;">
            <button type="button" mat-stroked-button routerLink="/topics">取消</button>
            <button type="submit" mat-raised-button color="primary" [disabled]="loading || form.invalid">
              {{ loading ? '提交中...' : '提交选题申报' }}
            </button>
          </div>
        </form>
      </mat-card>
    </div>
  `,
})
export class TopicNewPageComponent {
  form: FormGroup;
  loading = false;
  PRIORITY_OPTIONS = PRIORITY_OPTIONS;
  CATEGORY_OPTIONS = CATEGORY_OPTIONS;

  constructor(
    private fb: FormBuilder,
    private topicService: TopicService,
    private router: Router,
    private snack: MatSnackBar
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(120)]],
      description: ['', [Validators.required, Validators.maxLength(2000)]],
      source: ['', [Validators.required]],
      priority: ['medium', [Validators.required]],
      category: ['', [Validators.required]],
      interview_deadline: [null],
      submission_deadline: [null],
    });
  }

  submit() {
    if (this.form.invalid) {
      this.snack.open('请完善必填项后再提交', '知道了', { duration: 3000 });
      return;
    }
    this.loading = true;
    const v = this.form.value;
    const toIso = (d: Date | null): string | null => {
      if (!d) return null;
      const dt = new Date(d);
      dt.setHours(23, 59, 59);
      return dt.toISOString();
    };
    const req: CreateTopicRequest = {
      title: v.title.trim(),
      description: v.description.trim(),
      source: v.source.trim(),
      priority: v.priority,
      category: v.category,
      interview_deadline: toIso(v.interview_deadline),
      submission_deadline: toIso(v.submission_deadline),
    };
    this.topicService.create(req).subscribe({
      next: (t) => {
        this.loading = false;
        this.snack.open(`选题申报成功！状态：待派发`, '去办理', { duration: 5000 }).onAction().subscribe(() => {
          this.router.navigate(['/topics', t.id]);
        });
        if (!this.router.navigated) {
          setTimeout(() => this.router.navigate(['/topics', t.id]), 600);
        }
      },
      error: (e: ApiError) => {
        this.loading = false;
        this.snack.open(`提交失败：${e.message}`, '知道了', { duration: 5000 });
      },
    });
  }
}
