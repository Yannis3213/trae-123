import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TopicService, AuthService, UserService } from '../services/api.service';
import { ApiError, Topic, TopicListResponse, ROLE_SHORT_LABEL, UserInfo, ProcessTopicRequest, CreateTopicRequest, BatchProcessRequest } from '../models';
import { RouterModule, Router } from '@angular/router';

interface TestCase {
  id: string;
  group: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  expectedError: string;
  run: () => Promise<void>;
}

@Component({
  selector: 'app-exception-demo',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <button mat-icon-button routerLink="/topics" style="margin-right:8px;"><mat-icon>arrow_back</mat-icon></button>
          <span style="font-size:24px;font-weight:700;color:#111827;">🧪 异常场景穿透测试入口</span>
        </div>
        <div style="font-size:12.5px;color:#6b7280;background:#fef3c7;padding:6px 12px;border-radius:8px;">
          当前用户：<b style="color:#92400e;">{{ user?.display_name }}</b>（{{ ROLE_SHORT_LABEL[user!.role] }}）· 可切换顶部角色测试越权
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px;">
        <mat-card *ngFor="let g of groups" style="padding:0;overflow:hidden;">
          <div style="padding:16px 20px;background:linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%);border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:700;font-size:15px;color:#1e3a8a;display:flex;align-items:center;gap:8px;">
              <mat-icon style="color:#3b82f6;">{{ g.icon }}</mat-icon>
              {{ g.label }}
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">共 {{ g.cases.length }} 个场景</div>
          </div>
          <div style="padding:14px 16px;">
            <div *ngFor="let c of g.cases; let last = $last" style="padding:12px 0;" [style.border-bottom]="!last ? '1px dashed #f1f5f9' : 'none'">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                    <span style="font-size:14px;">{{ c.icon }}</span>
                    <b style="font-size:13.5px;color:#111827;">{{ c.title }}</b>
                    <span style="font-family:monospace;font-size:10.5px;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;">{{ c.expectedError }}</span>
                  </div>
                  <div style="font-size:12px;color:#64748b;line-height:1.6;">{{ c.desc }}</div>
                </div>
                <button
                  mat-raised-button
                  color="warn"
                  style="white-space:nowrap;flex-shrink:0;"
                  (click)="runCase(c)"
                  [disabled]="caseRunning[c.id]"
                >
                  <mat-icon *ngIf="!caseRunning[c.id]" style="margin-right:4px;">play_arrow</mat-icon>
                  <mat-spinner *ngIf="caseRunning[c.id]" diameter="16" style="margin-right:4px;"></mat-spinner>
                  {{ caseRunning[c.id] ? '运行中' : '运行' }}
                </button>
              </div>
              <div *ngIf="caseResults[c.id]" style="margin-top:10px;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.7;"
                [style.background]="caseResults[c.id].ok ? '#ecfdf5' : '#fef2f2'"
                [style.color]="caseResults[c.id].ok ? '#065f46' : '#991b1b'"
              >
                <div style="font-weight:700;margin-bottom:3px;">
                  <span *ngIf="caseResults[c.id].ok">✅ 符合预期</span>
                  <span *ngIf="!caseResults[c.id].ok">❌ 未拦截 / 与预期不符</span>
                  <span style="float:right;opacity:0.75;">实际码：{{ caseResults[c.id].actualCode || 'N/A' }}</span>
                </div>
                <div>{{ caseResults[c.id].message }}</div>
              </div>
            </div>
          </div>
        </mat-card>
      </div>

      <mat-card style="margin-top:20px;padding:18px 22px;">
        <h4 style="font-size:14px;font-weight:600;margin:0 0 10px;">🎯 四组演示单据（穿透测试建议使用）</h4>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;font-size:12.5px;line-height:1.7;">
          <div *ngFor="let demo of demoTopics" style="padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e5e7eb;">
            <div style="font-weight:700;color:#111827;margin-bottom:3px;">
              <span style="margin-right:4px;">{{ demo.type }}</span>
              <button mat-button style="padding:0 4px;font-size:11px;min-height:0;line-height:20px;color:#2563eb;" (click)="goTopic(demo.needle)">→ 定位</button>
            </div>
            <div style="color:#374151;margin-bottom:4px;"><b>预期场景：</b>{{ demo.scenario }}</div>
            <div style="color:#6b7280;font-size:11.5px;">标题关键字：「{{ demo.needle }}」 · {{ demo.extra }}</div>
          </div>
        </div>
      </mat-card>
    </div>
  `,
})
export class ExceptionDemoPageComponent implements OnInit {
  ROLE_SHORT_LABEL = ROLE_SHORT_LABEL;
  user = this.auth.currentUser;
  topics: Topic[] = [];
  userList: UserInfo[] = [];
  caseRunning: Record<string, boolean> = {};
  caseResults: Record<string, { ok: boolean; actualCode: string; message: string }> = {};

  groups: { key: string; label: string; icon: string; cases: TestCase[] }[] = [];

  demoTopics = [
    { type: '🔵 正常流转', needle: '地铁四号线', scenario: '待派发 → 派发领取 → 处理中 → 提交复核 → 关闭 → 归档', extra: '初始状态：待派发，采访/稿件截止未逾期' },
    { type: '🟠 临期/逾期', needle: '乡村振兴示范村', scenario: '采访节点已逾期，批量派发/关闭会被拦截，详情页可手动办理', extra: '初始状态：处理中（责任编辑），采访截止已逾期，含采访附件' },
    { type: '🔴 缺材料', needle: '智慧教育平台', scenario: '退回补正题单，登记员补正后重新派发，核验证据完整性', extra: '初始状态：退回补正（登记员为当前处理人），含退回原因' },
    { type: '🟣 冲突/越权', needle: '经济发展成就', scenario: '版本冲突、越权提交、状态冲突测试用例，已提交复核待总编室', extra: '初始状态：处理中（总编室），三类证据齐全，稿件截止已逾期' },
  ];

  constructor(
    private topicService: TopicService,
    private auth: AuthService,
    private userService: UserService,
    private snack: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit() {
    this.auth.user$.subscribe((u) => {
      this.user = u;
      this.buildTestCases();
    });
    this.user = this.auth.currentUser;
    this.userService.list().subscribe({ next: (l) => (this.userList = l) });
    this.topicService.list({ page_size: 100 }).subscribe({
      next: (r: TopicListResponse) => {
        this.topics = r.items;
        this.buildTestCases();
      },
    });
    this.buildTestCases();
  }

  findTopic(needle: string): Topic | null {
    return this.topics.find((t) => t.title.includes(needle)) || null;
  }

  goTopic(needle: string) {
    const t = this.findTopic(needle);
    if (t) this.router.navigate(['/topics', t.id]);
    else this.snack.open(`未找到包含「${needle}」的题单，请刷新列表`, '好的', { duration: 4000 });
  }

  async runCase(c: TestCase) {
    this.caseRunning[c.id] = true;
    delete this.caseResults[c.id];
    try {
      await c.run();
      this.caseResults[c.id] = { ok: false, actualCode: 'NO_ERROR', message: '后端未抛出预期的错误，场景未被拦截！' };
    } catch (e: any) {
      const ae = e as ApiError;
      const ok = ae.code === c.expectedError || ae.code?.includes(c.expectedError) || (c.expectedError === 'STATE' && ae.code?.includes('STATE')) || (c.expectedError === 'VALID' && ae.code?.includes('VALID'));
      this.caseResults[c.id] = {
        ok,
        actualCode: ae.code || 'UNKNOWN',
        message: ae.message || JSON.stringify(e),
      };
    } finally {
      this.caseRunning[c.id] = false;
    }
  }

  buildTestCases() {
    const cases: TestCase[] = [];
    const user = this.user;
    const t_overdue = this.findTopic('乡村振兴');
    const t_returned = this.findTopic('智慧教育');
    const t_reviewer = this.findTopic('经济发展');
    const t_pending = this.findTopic('地铁四号线');

    // 组1：越权访问
    cases.push({
      id: 't1', group: '越权类', title: '登记员尝试提交复核（应为审核主管权限）',
      desc: user?.role === 'registrar'
        ? '以登记员身份调用 process 接口提交复核，要求登记员无权执行'
        : '请切换到【采编助理】账号后运行本用例（复核权限仅责任编辑）',
      icon: '🚫', color: '#dc2626', expectedError: 'FORBIDDEN',
      run: async () => {
        const t = t_pending || t_overdue || this.topics[0];
        if (!t) throw new Error('没有可用题单');
        await this.topicService.process(t.id, {
          action: 'submit_review', opinion: '越权提交', version: t.version,
        } as any).toPromise();
      },
    });
    cases.push({
      id: 't2', group: '越权类', title: '非当前处理人尝试退回补正',
      desc: '对当前处理人不为自己的题单执行退回操作，要求后端按当前处理人校验拒绝',
      icon: '👤', color: '#dc2626', expectedError: 'FORBIDDEN',
      run: async () => {
        let target = t_pending;
        if (!target) target = this.topics.find((t) => t.status === 'pending_dispatch') || this.topics[0];
        if (!target) throw new Error('无题单');
        await this.topicService.process(target.id, {
          action: 'return', opinion: '强制退回测试', version: target.version,
        }).toPromise();
      },
    });
    cases.push({
      id: 't3', group: '越权类', title: '登记员尝试关闭题单（仅总编室）',
      desc: '登记员无权执行关闭操作，要求后端按角色拒绝',
      icon: '🔒', color: '#dc2626', expectedError: 'FORBIDDEN',
      run: async () => {
        const t = t_reviewer || t_overdue || this.topics[0];
        if (!t) throw new Error('无题单');
        await this.topicService.process(t.id, {
          action: 'close', opinion: '越权关闭', version: t.version,
        }).toPromise();
      },
    });

    // 组2：状态冲突
    cases.push({
      id: 's1', group: '状态冲突类', title: '已关闭题单尝试派发',
      desc: '对已关闭/已归档题单调用派发接口，应报状态冲突',
      icon: '⚡', color: '#f59e0b', expectedError: 'STATE_CONFLICT',
      run: async () => {
        let target = this.topics.find((t) => t.status === 'closed');
        if (!target) target = this.topics.find((t) => t.status === 'archived');
        if (!target) throw new Error('找不到已关闭/已归档题单，请先关闭一条再试');
        await this.topicService.process(target.id, {
          action: 'dispatch', opinion: '测试状态冲突', version: target.version,
        }).toPromise();
      },
    });
    cases.push({
      id: 's2', group: '状态冲突类', title: '待派发题单直接执行关闭',
      desc: '跳过流程节点：待派发 → 关闭，要求后端按状态流转校验拦截',
      icon: '⏭️', color: '#f59e0b', expectedError: 'STATE_CONFLICT',
      run: async () => {
        const t = t_pending || this.topics.find((x) => x.status === 'pending_dispatch');
        if (!t) throw new Error('无待派发题单');
        await this.topicService.process(t.id, {
          action: 'close', opinion: '跳过流程直接关', version: t.version,
        }).toPromise();
      },
    });
    cases.push({
      id: 's3', group: '状态冲突类', title: '退回补正题单不指定处理人直接派发',
      desc: '退回补正题单由登记员重新提交时必须指定下一处理人，缺参数应校验失败',
      icon: '🧭', color: '#f59e0b', expectedError: 'VALIDATION_FAILED',
      run: async () => {
        const t = t_returned || this.topics.find((x) => x.status === 'returned');
        if (!t) throw new Error('无退回补正题单');
        await this.topicService.process(t.id, {
          action: 'dispatch', opinion: '缺处理人', target_handler_id: null as any, version: t.version,
        }).toPromise();
      },
    });

    // 组3：版本冲突 & 重复提交
    cases.push({
      id: 'v1', group: '版本/重复类', title: '提交过期版本号',
      desc: '版本参数落后于当前版本 2，应触发 VERSION_CONFLICT',
      icon: '🔄', color: '#8b5cf6', expectedError: 'VERSION_CONFLICT',
      run: async () => {
        const t = t_overdue || t_pending || this.topics[0];
        if (!t) throw new Error('无题单');
        await this.topicService.process(t.id, {
          action: 'progress', opinion: '旧版本测试', version: Math.max(1, t.version - 2),
        }).toPromise();
      },
    });
    cases.push({
      id: 'v2', group: '版本/重复类', title: '连续提交同一版本（模拟重复点击）',
      desc: '对同一条操作连续提交两次，第二次应被版本机制拦截',
      icon: '👆👆', color: '#8b5cf6', expectedError: 'VERSION_CONFLICT',
      run: async () => {
        const t = this.topics.find((x) => x.status === 'processing' && x.current_handler_id === user?.id);
        if (!t) throw new Error('你名下暂无处理中题单，请切换到有题单的角色');
        await this.topicService.process(t.id, {
          action: 'progress', opinion: '第一次（会成功，推动版本+1）', version: t.version,
        }).toPromise();
        await this.topicService.process(t.id, {
          action: 'progress', opinion: '第二次（预期被拦截）', version: t.version,
        }).toPromise();
      },
    });
    cases.push({
      id: 'v3', group: '版本/重复类', title: '更新基本信息使用旧版本',
      desc: 'PUT /topics/:id 携带旧版本号，应触发版本冲突',
      icon: '📝', color: '#8b5cf6', expectedError: 'VERSION_CONFLICT',
      run: async () => {
        const t = t_returned || t_pending || this.topics[0];
        if (!t) throw new Error('无题单');
        await this.topicService.update(t.id, {
          title: '旧版本更新测试', version: Math.max(1, t.version - 1),
        }).toPromise();
      },
    });

    // 组4：证据/必填核验
    cases.push({
      id: 'e1', group: '必填/证据类', title: '提交复核但缺失稿件附件',
      desc: '对仅有申报+采访、缺稿件的处理中题单调用 submit_review',
      icon: '📎', color: '#0ea5e9', expectedError: 'VALIDATION_FAILED',
      run: async () => {
        const t = t_overdue;
        if (!t) throw new Error('无乡村振兴示范村题单');
        await this.topicService.process(t.id, {
          action: 'submit_review', opinion: '故意缺稿件', version: t.version,
        }).toPromise();
      },
    });
    cases.push({
      id: 'e2', group: '必填/证据类', title: '处理意见为空',
      desc: 'opinion 为空字符串提交，后端应返回校验失败',
      icon: '💬', color: '#0ea5e9', expectedError: 'VALIDATION_FAILED',
      run: async () => {
        const t = this.topics.find((x) => x.current_handler_id === user?.id) || this.topics[0];
        if (!t) throw new Error('无题单');
        await this.topicService.process(t.id, {
          action: 'progress', opinion: '   ', version: t.version,
        }).toPromise();
      },
    });
    cases.push({
      id: 'e3', group: '必填/证据类', title: '登记员新建题单标题为空',
      desc: '验证 CreateTopicRequest 必填字段校验（仅登记员角色）',
      icon: '➕', color: '#0ea5e9', expectedError: 'VALIDATION_FAILED',
      run: async () => {
        await this.topicService.create({
          title: '  ', description: '有描述无标题', source: 'test', priority: 'medium', category: '其他',
        } as CreateTopicRequest).toPromise();
      },
    });

    // 组5：批量场景
    cases.push({
      id: 'b1', group: '批量处理类', title: '批量关闭含逾期题单（逐条拦截）',
      desc: '选择至少 1 条逾期题单参与批量关闭，预期该条被 OVERDUE_BLOCKED 拦截',
      icon: '📚', color: '#ef4444', expectedError: '（看明细）',
      run: async () => {
        const overdues = this.topics.filter((t) => t.is_overdue).slice(0, 3);
        const normals = this.topics.filter((t) => !t.is_overdue).slice(0, 2);
        const all = [...overdues, ...normals];
        if (all.length < 2) throw new Error('至少需2条题单，请刷新列表');
        const versions: Record<string, number> = {};
        all.forEach((t) => (versions[t.id] = t.version));
        const resp = await this.topicService.batch({
          ids: all.map((t) => t.id),
          action: 'close',
          opinion: '批量逾期测试',
          versions,
        } as BatchProcessRequest).toPromise();
        if (!resp) throw { code: 'EMPTY', message: '批量结果为空' } as ApiError;
        const hasBlocked = resp.results.some((r) => r.error_code === 'OVERDUE_BLOCKED');
        if (overdues.length > 0 && !hasBlocked) {
          throw { code: 'BLOCK_FAILED', message: `逾期条目未被拦截：成功${resp.success_count}，失败${resp.failed_count}` } as ApiError;
        }
        if (resp.failed_count === 0 && resp.success_count === 0) {
          throw { code: 'EMPTY', message: '批量结果全空' } as ApiError;
        }
        throw { code: 'OK_BUT_CHECK', message: `批量执行完成：成功${resp.success_count}，失败${resp.failed_count}${hasBlocked ? '（逾期拦截生效）' : '（无逾期条目）'}` } as ApiError;
      },
    });
    cases.push({
      id: 'b2', group: '批量处理类', title: '批量提交 ID 列表为空',
      desc: 'ids 传空数组触发 BAD_REQUEST',
      icon: '🫗', color: '#ef4444', expectedError: 'BAD_REQUEST',
      run: async () => {
        await this.topicService.batch({
          ids: [], action: 'progress', opinion: '空列表', versions: {},
        }).toPromise();
      },
    });
    cases.push({
      id: 'b3', group: '批量处理类', title: '批量操作意见为空',
      desc: '批量处理 opinion 为空触发 VALIDATION_FAILED',
      icon: '✏️', color: '#ef4444', expectedError: 'VALIDATION_FAILED',
      run: async () => {
        const list = this.topics.slice(0, 2);
        if (list.length === 0) throw new Error('无题单');
        const versions: Record<string, number> = {};
        list.forEach((t) => (versions[t.id] = t.version));
        await this.topicService.batch({
          ids: list.map((t) => t.id),
          action: 'progress',
          opinion: '',
          versions,
        }).toPromise();
      },
    });

    // 组6：非法访问
    cases.push({
      id: 'a1', group: '未授权类', title: '不带 Token 访问 /api/topics',
      desc: '直接用未授权请求访问受保护接口，返回 UNAUTHORIZED',
      icon: '🎟️', color: '#64748b', expectedError: 'UNAUTHORIZED',
      run: async () => {
        const saved = localStorage.getItem('news_editorial_token');
        localStorage.removeItem('news_editorial_token');
        try {
          await this.topicService.list({}).toPromise();
        } finally {
          if (saved) localStorage.setItem('news_editorial_token', saved);
        }
      },
    });
    cases.push({
      id: 'a2', group: '未授权类', title: '访问不存在的题单 ID',
      desc: 'GET /api/topics/:fakeid 返回 NOT_FOUND',
      icon: '❓', color: '#64748b', expectedError: 'NOT_FOUND',
      run: async () => {
        await this.topicService.detail('00000000-0000-0000-0000-000000000000').toPromise();
      },
    });

    const groupsMap: Record<string, TestCase[]> = {};
    cases.forEach((c) => {
      (groupsMap[c.group] ||= []).push(c);
    });
    const groupsMeta = [
      { key: '越权类', label: '🚫 越权访问测试', icon: 'no_accounts' },
      { key: '状态冲突类', label: '⚡ 状态冲突测试', icon: 'sync_problem' },
      { key: '版本/重复类', label: '🔄 版本/重复提交测试', icon: 'repeat_on' },
      { key: '必填/证据类', label: '📎 必填/证据核验', icon: 'fact_check' },
      { key: '批量处理类', label: '📚 批量处理异常', icon: 'inventory_2' },
      { key: '未授权类', label: '🎟️ 授权/鉴权测试', icon: 'vpn_key' },
    ];
    this.groups = groupsMeta
      .filter((m) => groupsMap[m.key]?.length)
      .map((m) => ({ ...m, cases: groupsMap[m.key] }));
  }
}
