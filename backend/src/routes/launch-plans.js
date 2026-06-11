import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import {
  ROLES, ROLE_NAMES, STATUSES, STATUS_NAMES, PRIORITY_NAMES,
  getDeadlineWarning, logException, checkRolePermission
} from '../middleware.js';

const SIMULATED_USERS = {
  '张三': ROLES.CS_MANAGER,
  '王五': ROLES.CS_MANAGER,
  '李四': ROLES.DELIVERY_CONSULTANT,
  '赵六': ROLES.DELIVERY_CONSULTANT,
  '王总': ROLES.CS_LEAD,
};

function getUserRole(name) {
  return SIMULATED_USERS[name] || ROLES.CS_MANAGER;
}

export default async function (fastify, opts) {
  const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss');

  const addComputedFields = (plan) => {
    if (!plan) return null;
    const handlerRole = getUserRole(plan.current_handler);
    return {
      ...plan,
      status_name: STATUS_NAMES[plan.status] || plan.status,
      priority_name: PRIORITY_NAMES[plan.priority] || plan.priority,
      deadline_warning: getDeadlineWarning(plan.deadline, plan.status),
      current_handler_role: handlerRole,
      current_handler_role_name: ROLE_NAMES[handlerRole] || handlerRole,
      assignee_role: plan.assignee ? (getUserRole(plan.assignee) || '') : '',
    };
  };

  fastify.get('/api/launch-plans', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          priority: { type: 'string' },
          owner: { type: 'string' },
          warning: { type: 'string' },
          keyword: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const { status, priority, owner, warning, keyword } = req.query;
      const conditions = [];
      const params = [];

      if (status) { conditions.push('status = ?'); params.push(status); }
      if (priority) { conditions.push('priority = ?'); params.push(priority); }
      if (owner) { conditions.push('owner = ?'); params.push(owner); }
      if (keyword) {
        conditions.push('(customer_name LIKE ? OR project_name LIKE ? OR plan_no LIKE ?)');
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = db.prepare(`SELECT * FROM launch_plans ${where} ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
        deadline ASC, created_at DESC`).all(...params);

      const enriched = rows.map(addComputedFields);
      const result = warning ? enriched.filter(p => p.deadline_warning === warning) : enriched;

      return { total: result.length, items: result };
    },
  });

  fastify.get('/api/launch-plans/stats', async (req, reply) => {
    const rows = db.prepare('SELECT status, COUNT(*) as cnt FROM launch_plans GROUP BY status').all();
    const stats = { total: 0, draft: 0, pending_review: 0, archived: 0 };
    for (const r of rows) { stats.total += r.cnt; stats[r.status] = r.cnt; }
    const all = db.prepare('SELECT deadline, status FROM launch_plans').all();
    stats.overdue = all.filter(r => getDeadlineWarning(r.deadline, r.status) === 'overdue').length;
    stats.urgent = all.filter(r => getDeadlineWarning(r.deadline, r.status) === 'urgent').length;
    stats.normal = all.filter(r => getDeadlineWarning(r.deadline, r.status) === 'normal' && r.status !== STATUSES.ARCHIVED).length;
    return stats;
  });

  fastify.get('/api/launch-plans/:id', async (req, reply) => {
    const plan = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
    if (!plan) { reply.status(404); return { error: '上线计划单不存在' }; }
    const attachments = db.prepare('SELECT * FROM attachments WHERE launch_plan_id = ? ORDER BY uploaded_at DESC').all(req.params.id);
    const processRecords = db.prepare('SELECT * FROM process_records WHERE launch_plan_id = ? ORDER BY created_at DESC').all(req.params.id);
    const auditNotes = db.prepare('SELECT * FROM audit_notes WHERE launch_plan_id = ? ORDER BY created_at DESC').all(req.params.id);
    const exceptions = db.prepare('SELECT * FROM exception_logs WHERE launch_plan_id = ? ORDER BY created_at DESC').all(req.params.id);
    return {
      plan: addComputedFields(plan),
      attachments,
      process_records: processRecords.map(r => ({
        ...r,
        from_status_name: STATUS_NAMES[r.from_status] || r.from_status,
        to_status_name: STATUS_NAMES[r.to_status] || r.to_status,
        operator_role_name: ROLE_NAMES[r.operator_role] || r.operator_role,
      })),
      audit_notes: auditNotes.map(a => ({
        ...a,
        author_role_name: ROLE_NAMES[a.author_role] || a.author_role,
      })),
      exception_logs: exceptions,
    };
  });

  fastify.post('/api/launch-plans', {
    schema: {
      body: {
        type: 'object',
        required: ['customer_name', 'project_name', 'priority', 'deadline', 'owner'],
      },
    },
    handler: async (req, reply) => {
      const user = req.user;
      if (!checkRolePermission(user, [ROLES.CS_MANAGER, ROLES.DELIVERY_CONSULTANT])) {
        reply.status(403); return { error: '当前角色无权限创建上线计划单' };
      }
      const body = req.body;
      const id = uuidv4();
      const planNo = `LP-${dayjs().format('YYYY-MM')}${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const ts = now();
      const initialHandler = body.owner || user.name;
      const assignee = body.assignee || '';

      db.prepare(`
        INSERT INTO launch_plans (
          id, plan_no, customer_name, project_name, priority, deadline, status,
          owner, current_handler, assignee, launch_target, config_checklist, acceptance_notes,
          last_submitter, version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, planNo, body.customer_name, body.project_name, body.priority, body.deadline,
        STATUSES.DRAFT, body.owner, initialHandler, assignee,
        body.launch_target || '', body.config_checklist || '', body.acceptance_notes || '',
        '', 1, user.name, ts, ts
      );

      db.prepare(`
        INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), id, 'create', '', STATUSES.DRAFT, user.name, user.role,
        `${ROLE_NAMES[user.role] || user.role}创建上线计划单`, '', ts);

      if (assignee && assignee !== body.owner) {
        db.prepare(`UPDATE launch_plans SET current_handler = ?, version = ?, updated_at = ? WHERE id = ?`)
          .run(assignee, 2, ts, id);
        db.prepare(`
          INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), id, 'assign', STATUSES.DRAFT, STATUSES.DRAFT, user.name, user.role,
          `建单时直接指派交付顾问${assignee}办理`, assignee, ts);
      }

      reply.status(201);
      return { id, plan_no: planNo };
    },
  });

  fastify.post('/api/launch-plans/:id/assign', {
    schema: {
      body: {
        type: 'object',
        required: ['version', 'assignee'],
        properties: {
          version: { type: 'integer' },
          assignee: { type: 'string', minLength: 1 },
          comment: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = req.user;
      const { version, assignee, comment } = req.body;

      if (!checkRolePermission(user, [ROLES.CS_MANAGER])) {
        reply.status(403); return { error: '仅客户成功经理有权指派交付顾问' };
      }

      const assigneeRole = getUserRole(assignee);
      if (assigneeRole !== ROLES.DELIVERY_CONSULTANT) {
        reply.status(400); return { error: '只能指派交付顾问办理，请选择交付顾问角色人员' };
      }

      const existing = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
      if (!existing) { reply.status(404); return { error: '上线计划单不存在' }; }
      if (existing.version !== version) {
        logException(req.params.id, 'version_conflict', `指派操作版本冲突`, user.name);
        reply.status(409); return { error: '版本冲突，请刷新后重试' };
      }
      if (existing.status !== STATUSES.DRAFT) {
        reply.status(400); return { error: `当前状态为${STATUS_NAMES[existing.status]}，只能在草稿状态指派` };
      }
      if (existing.owner !== user.name && user.role !== ROLES.CS_LEAD) {
        reply.status(403); return { error: '仅本单责任人（客户成功经理）或客户成功负责人可指派' };
      }
      if (existing.current_handler === assignee && existing.assignee === assignee) {
        reply.status(400); return { error: `交付顾问${assignee}已被指派，无需重复操作` };
      }

      const ts = now();
      db.prepare(`UPDATE launch_plans SET current_handler = ?, assignee = ?, version = ?, updated_at = ? WHERE id = ?`)
        .run(assignee, assignee, existing.version + 1, ts, req.params.id);

      db.prepare(`
        INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), req.params.id, 'assign', STATUSES.DRAFT, STATUSES.DRAFT,
        user.name, user.role, comment || `指派交付顾问${assignee}办理`, assignee, ts);

      db.prepare(`INSERT INTO audit_notes (id, launch_plan_id, note, author, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), req.params.id, `客户成功经理${user.name}指派交付顾问${assignee}办理`, user.name, user.role, ts);

      return { message: `已指派交付顾问${assignee}办理`, new_version: existing.version + 1 };
    },
  });

  fastify.post('/api/launch-plans/:id/accept', {
    schema: {
      body: {
        type: 'object',
        required: ['version'],
        properties: {
          version: { type: 'integer' },
          comment: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      const user = req.user;
      const { version, comment } = req.body;

      if (!checkRolePermission(user, [ROLES.DELIVERY_CONSULTANT])) {
        reply.status(403); return { error: '仅交付顾问有权接办' };
      }

      const existing = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
      if (!existing) { reply.status(404); return { error: '上线计划单不存在' }; }
      if (existing.version !== version) {
        logException(req.params.id, 'version_conflict', `接办操作版本冲突`, user.name);
        reply.status(409); return { error: '版本冲突，请刷新后重试' };
      }
      if (existing.status !== STATUSES.DRAFT) {
        reply.status(400); return { error: `当前状态为${STATUS_NAMES[existing.status]}，只能在草稿状态接办` };
      }
      if (existing.current_handler !== user.name) {
        reply.status(403); return { error: `当前处理人为${existing.current_handler}，非本人无法接办` };
      }

      const ts = now();
      db.prepare(`UPDATE launch_plans SET version = ?, updated_at = ? WHERE id = ?`)
        .run(existing.version + 1, ts, req.params.id);

      db.prepare(`
        INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), req.params.id, 'accept', STATUSES.DRAFT, STATUSES.DRAFT,
        user.name, user.role, comment || '交付顾问接办，开始处理', '', ts);

      return { message: '已接办，开始处理', new_version: existing.version + 1 };
    },
  });

  fastify.put('/api/launch-plans/:id', {
    schema: { body: { type: 'object', required: ['version'] } },
    handler: async (req, reply) => {
      const user = req.user;
      const { version, ...updates } = req.body;
      const existing = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
      if (!existing) { reply.status(404); return { error: '上线计划单不存在' }; }
      if (existing.version !== version) {
        logException(req.params.id, 'version_conflict', `提交版本${version}与后端版本${existing.version}冲突`, user.name);
        reply.status(409); return { error: '版本冲突：该单据已被他人修改，请刷新后重试', current_version: existing.version };
      }
      if (existing.status === STATUSES.ARCHIVED) { reply.status(400); return { error: '已归档的单据不能修改' }; }
      if (existing.current_handler !== user.name && user.role !== ROLES.CS_LEAD
        && !(user.role === ROLES.CS_MANAGER && existing.owner === user.name)) {
        reply.status(403); return { error: `当前处理人应为${existing.current_handler}，或由负责人修改` };
      }
      const allowedFields = ['customer_name', 'project_name', 'priority', 'deadline', 'launch_target', 'config_checklist', 'acceptance_notes', 'result', 'reject_reason'];
      const sets = [];
      const values = [];
      for (const f of allowedFields) {
        if (updates[f] !== undefined) { sets.push(`${f} = ?`); values.push(updates[f]); }
      }
      if (sets.length === 0) return { message: '无更新内容' };
      sets.push('version = ?'); values.push(existing.version + 1);
      sets.push('updated_at = ?'); values.push(now());
      values.push(req.params.id);
      db.prepare(`UPDATE launch_plans SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      db.prepare(`INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), req.params.id, 'update', existing.status, existing.status, user.name, user.role, '更新上线计划单内容', '', now());
      return { message: '更新成功', new_version: existing.version + 1 };
    },
  });

  fastify.post('/api/launch-plans/:id/submit', {
    schema: { body: { type: 'object', required: ['version'] } },
    handler: async (req, reply) => {
      const user = req.user;
      const { version, comment, evidence } = req.body;
      if (!checkRolePermission(user, [ROLES.CS_MANAGER, ROLES.DELIVERY_CONSULTANT])) {
        reply.status(403); return { error: '当前角色无权限提交审核' };
      }
      const existing = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
      if (!existing) { reply.status(404); return { error: '上线计划单不存在' }; }
      if (existing.version !== version) {
        logException(req.params.id, 'version_conflict', `提交审核版本冲突`, user.name);
        reply.status(409); return { error: '版本冲突，请刷新后重试' };
      }
      if (existing.status !== STATUSES.DRAFT) {
        reply.status(400); return { error: `当前状态为${STATUS_NAMES[existing.status]}，不能提交审核` };
      }
      if (existing.current_handler !== user.name && existing.owner !== user.name) {
        reply.status(403); return { error: `当前处理人应为${existing.current_handler}或责任人${existing.owner}` };
      }
      const missing = [];
      if (!existing.launch_target || existing.launch_target.trim().length < 10) missing.push('上线目标');
      if (!existing.config_checklist || existing.config_checklist.trim().length < 10) missing.push('配置检查清单');
      if (missing.length > 0) {
        logException(req.params.id, 'missing_evidence', `提交时缺少必要证据: ${missing.join('、')}`, user.name);
        reply.status(400); return { error: `提交前请补齐材料：${missing.join('、')}` };
      }
      const attachCount = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE launch_plan_id = ?').get(req.params.id).cnt;
      if (attachCount < 1 && !evidence) {
        logException(req.params.id, 'missing_evidence', '提交审核缺少附件或证据说明', user.name);
        reply.status(400); return { error: '请至少上传一个附件或填写证据说明' };
      }
      const ts = now();
      const csLead = Object.entries(SIMULATED_USERS).find(([, r]) => r === ROLES.CS_LEAD)?.[0] || '王总';
      db.prepare(`UPDATE launch_plans SET status = ?, current_handler = ?, last_submitter = ?, version = ?, updated_at = ?, reject_reason = '' WHERE id = ?`)
        .run(STATUSES.PENDING_REVIEW, csLead, user.name, existing.version + 1, ts, req.params.id);
      db.prepare(`INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), req.params.id, 'submit', STATUSES.DRAFT, STATUSES.PENDING_REVIEW,
          user.name, user.role, comment || '提交复核', evidence || '已按要求上传附件', ts);
      return { message: '已提交复核', new_version: existing.version + 1 };
    },
  });

  fastify.post('/api/launch-plans/:id/reject', {
    schema: { body: { type: 'object', required: ['version', 'reject_reason'] } },
    handler: async (req, reply) => {
      const user = req.user;
      if (!checkRolePermission(user, [ROLES.CS_LEAD])) {
        reply.status(403); return { error: '仅客户成功负责人有权退回' };
      }
      const { version, reject_reason, comment } = req.body;
      const existing = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
      if (!existing) { reply.status(404); return { error: '上线计划单不存在' }; }
      if (existing.version !== version) {
        logException(req.params.id, 'version_conflict', `退回操作版本冲突`, user.name);
        reply.status(409); return { error: '版本冲突，请刷新后重试' };
      }
      if (existing.status !== STATUSES.PENDING_REVIEW) {
        reply.status(400); return { error: `当前状态为${STATUS_NAMES[existing.status]}，不能退回` };
      }

      const returnHandler = existing.last_submitter || existing.assignee || existing.owner;

      const ts = now();
      db.prepare(`UPDATE launch_plans SET status = ?, current_handler = ?, reject_reason = ?, version = ?, updated_at = ? WHERE id = ?`)
        .run(STATUSES.DRAFT, returnHandler, reject_reason, existing.version + 1, ts, req.params.id);
      db.prepare(`INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), req.params.id, 'reject', STATUSES.PENDING_REVIEW, STATUSES.DRAFT,
          user.name, user.role, comment || '退回补正', reject_reason, ts);
      db.prepare(`INSERT INTO audit_notes (id, launch_plan_id, note, author, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), req.params.id, `退回原因：${reject_reason}。${comment || ''} 退回给${returnHandler}补正。`, user.name, user.role, ts);
      return { message: `已退回给${returnHandler}补正`, new_version: existing.version + 1, return_handler: returnHandler };
    },
  });

  fastify.post('/api/launch-plans/:id/archive', {
    schema: { body: { type: 'object', required: ['version'] } },
    handler: async (req, reply) => {
      const user = req.user;
      if (!checkRolePermission(user, [ROLES.CS_LEAD])) {
        reply.status(403); return { error: '仅客户成功负责人有权归档' };
      }
      const { version, result, audit_note, evidence } = req.body;
      const existing = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
      if (!existing) { reply.status(404); return { error: '上线计划单不存在' }; }
      if (existing.version !== version) {
        logException(req.params.id, 'version_conflict', `归档操作版本冲突`, user.name);
        reply.status(409); return { error: '版本冲突，请刷新后重试' };
      }
      if (existing.status !== STATUSES.PENDING_REVIEW) {
        reply.status(400); return { error: `当前状态为${STATUS_NAMES[existing.status]}，不能归档` };
      }
      if (!existing.acceptance_notes || existing.acceptance_notes.trim().length < 10) {
        reply.status(400); return { error: '归档前验收确认内容不能为空或不完整' };
      }
      if (!result || result.trim().length < 5) {
        reply.status(400); return { error: '请填写处理结果后归档' };
      }
      const ts = now();
      db.prepare(`UPDATE launch_plans SET status = ?, result = ?, version = ?, updated_at = ? WHERE id = ?`)
        .run(STATUSES.ARCHIVED, result, existing.version + 1, ts, req.params.id);
      db.prepare(`INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), req.params.id, 'archive', STATUSES.PENDING_REVIEW, STATUSES.ARCHIVED,
          user.name, user.role, result, evidence || '验收材料完整', ts);
      if (audit_note) {
        db.prepare(`INSERT INTO audit_notes (id, launch_plan_id, note, author, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(uuidv4(), req.params.id, audit_note, user.name, user.role, ts);
      }
      return { message: '已归档', new_version: existing.version + 1 };
    },
  });

  fastify.post('/api/launch-plans/batch-advance', {
    schema: { body: { type: 'object', required: ['ids', 'target_status'] } },
    handler: async (req, reply) => {
      const user = req.user;
      const { ids, target_status, comment } = req.body;
      if (!checkRolePermission(user, [ROLES.CS_LEAD, ROLES.CS_MANAGER])) {
        reply.status(403); return { error: '无权批量推进' };
      }
      const results = [];
      const tx = db.transaction(() => {
        for (const id of ids) {
          const plan = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(id);
          if (!plan) {
            results.push({ id, success: false, result_type: 'error', reason: '单据不存在' });
            continue;
          }
          const warning = getDeadlineWarning(plan.deadline, plan.status);
          if (plan.status === STATUSES.ARCHIVED) {
            results.push({ id, plan_no: plan.plan_no, customer_name: plan.customer_name, success: false, result_type: 'error', reason: '已归档单据无需推进' });
            continue;
          }
          if (warning === 'overdue') {
            logException(id, 'overdue_blocked', `批量推进拦截：单据已逾期，责任人${plan.owner}，当前处理人${plan.current_handler}`, user.name);
            db.prepare(`INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(uuidv4(), id, 'overdue_blocked', plan.status, plan.status, user.name, user.role,
                `批量推进拦截：单据已逾期，请在详情页处理补正。责任人：${plan.owner}，当前处理人：${plan.current_handler}，截止日期：${plan.deadline}`, '逾期拦截', now());
            results.push({
              id, plan_no: plan.plan_no, customer_name: plan.customer_name,
              success: false, result_type: 'overdue_blocked',
              reason: `已逾期拦截：截止${plan.deadline}，责任人${plan.owner}，处理人${plan.current_handler}，请在详情页补正`,
              correction_hint: `补正建议：更新截止日期或补充材料后手动提交`,
            });
            continue;
          }
          if (target_status === STATUSES.PENDING_REVIEW) {
            if (plan.status !== STATUSES.DRAFT) {
              results.push({ id, plan_no: plan.plan_no, customer_name: plan.customer_name, success: false, result_type: 'error', reason: `当前状态为${STATUS_NAMES[plan.status]}，无法推进到待复核` });
              continue;
            }
            const missing = [];
            if (!plan.launch_target || plan.launch_target.trim().length < 10) missing.push('上线目标');
            if (!plan.config_checklist || plan.config_checklist.trim().length < 10) missing.push('配置检查');
            if (missing.length > 0) {
              logException(id, 'missing_evidence', `批量推进拦截：缺少${missing.join('、')}`, user.name);
              results.push({
                id, plan_no: plan.plan_no, customer_name: plan.customer_name,
                success: false, result_type: 'missing_evidence',
                reason: `材料不完整：缺少${missing.join('、')}`,
                correction_hint: `补正建议：在详情页填写${missing.join('、')}后重新提交`,
              });
              continue;
            }
            const csLead = Object.entries(SIMULATED_USERS).find(([, r]) => r === ROLES.CS_LEAD)?.[0] || '王总';
            db.prepare(`UPDATE launch_plans SET status = ?, current_handler = ?, last_submitter = ?, version = ?, updated_at = ? WHERE id = ?`)
              .run(STATUSES.PENDING_REVIEW, csLead, plan.current_handler, plan.version + 1, now(), id);
            db.prepare(`INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(uuidv4(), id, 'submit', STATUSES.DRAFT, STATUSES.PENDING_REVIEW, user.name, user.role, comment || '批量推进到待复核', '批量操作', now());
            results.push({ id, plan_no: plan.plan_no, customer_name: plan.customer_name, success: true, result_type: 'success', reason: '已提交复核' });
          } else if (target_status === STATUSES.ARCHIVED) {
            if (!checkRolePermission(user, [ROLES.CS_LEAD])) {
              results.push({ id, plan_no: plan.plan_no, customer_name: plan.customer_name, success: false, result_type: 'error', reason: '仅客户成功负责人可批量归档' });
              continue;
            }
            if (plan.status !== STATUSES.PENDING_REVIEW) {
              results.push({ id, plan_no: plan.plan_no, customer_name: plan.customer_name, success: false, result_type: 'error', reason: `当前状态为${STATUS_NAMES[plan.status]}，无法归档` });
              continue;
            }
            if (!plan.acceptance_notes || plan.acceptance_notes.trim().length < 10) {
              results.push({
                id, plan_no: plan.plan_no, customer_name: plan.customer_name,
                success: false, result_type: 'missing_evidence',
                reason: '验收确认不完整，无法归档',
                correction_hint: '补正建议：在详情页完善验收确认内容后由负责人手动归档',
              });
              continue;
            }
            db.prepare(`UPDATE launch_plans SET status = ?, result = ?, version = ?, updated_at = ? WHERE id = ?`)
              .run(STATUSES.ARCHIVED, comment || '批量归档完成', plan.version + 1, now(), id);
            db.prepare(`INSERT INTO process_records (id, launch_plan_id, action, from_status, to_status, operator, operator_role, comment, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(uuidv4(), id, 'archive', STATUSES.PENDING_REVIEW, STATUSES.ARCHIVED, user.name, user.role, comment || '批量归档', '批量操作', now());
            results.push({ id, plan_no: plan.plan_no, customer_name: plan.customer_name, success: true, result_type: 'success', reason: '已归档' });
          }
        }
      });
      try { tx(); } catch (err) { reply.status(500); return { error: '批量处理异常：' + err.message }; }
      return {
        total: results.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        overdue_blocked: results.filter(r => r.result_type === 'overdue_blocked').length,
        missing_evidence: results.filter(r => r.result_type === 'missing_evidence').length,
        items: results,
      };
    },
  });

  fastify.post('/api/launch-plans/:id/attachments', async (req, reply) => {
    const user = req.user;
    const plan = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(req.params.id);
    if (!plan) { reply.status(404); return { error: '上线计划单不存在' }; }
    if (plan.status === STATUSES.ARCHIVED) { reply.status(400); return { error: '已归档单据不能上传附件' }; }
    const uploadDir = path.join(process.cwd(), 'uploads', req.params.id);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const parts = req.parts();
    const saved = [];
    for await (const part of parts) {
      if (part.filename) {
        const fileName = `${Date.now()}_${part.filename}`;
        const filePath = path.join(uploadDir, fileName);
        const buf = await part.toBuffer();
        fs.writeFileSync(filePath, buf);
        const id = uuidv4();
        db.prepare(`INSERT INTO attachments (id, launch_plan_id, file_name, file_path, file_size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(id, req.params.id, part.filename, filePath, buf.length, user.name, now());
        saved.push({ id, file_name: part.filename, file_size: buf.length });
      }
    }
    db.prepare(`UPDATE launch_plans SET version = version + 1, updated_at = ? WHERE id = ?`).run(now(), req.params.id);
    return { uploaded: saved.length, files: saved };
  });

  fastify.delete('/api/attachments/:id', async (req, reply) => {
    const user = req.user;
    const att = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    if (!att) { reply.status(404); return { error: '附件不存在' }; }
    const plan = db.prepare('SELECT * FROM launch_plans WHERE id = ?').get(att.launch_plan_id);
    if (plan.status === STATUSES.ARCHIVED) { reply.status(400); return { error: '已归档单据附件不能删除' }; }
    if (att.uploaded_by !== user.name && user.role !== ROLES.CS_LEAD) { reply.status(403); return { error: '仅上传者或负责人可删除附件' }; }
    try { if (fs.existsSync(att.file_path)) fs.unlinkSync(att.file_path); } catch {}
    db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
    db.prepare(`UPDATE launch_plans SET version = version + 1, updated_at = ? WHERE id = ?`).run(now(), att.launch_plan_id);
    return { success: true };
  });

  fastify.post('/api/launch-plans/:id/audit-notes', {
    schema: { body: { type: 'object', required: ['note'] } },
    handler: async (req, reply) => {
      const user = req.user;
      const plan = db.prepare('SELECT id FROM launch_plans WHERE id = ?').get(req.params.id);
      if (!plan) { reply.status(404); return { error: '上线计划单不存在' }; }
      const id = uuidv4();
      db.prepare(`INSERT INTO audit_notes (id, launch_plan_id, note, author, author_role, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(id, req.params.id, req.body.note, user.name, user.role, now());
      reply.status(201); return { id };
    },
  });

  fastify.get('/api/users', async (req, reply) => {
    return [
      { name: '张三', role: ROLES.CS_MANAGER, role_name: ROLE_NAMES.cs_manager },
      { name: '王五', role: ROLES.CS_MANAGER, role_name: ROLE_NAMES.cs_manager },
      { name: '李四', role: ROLES.DELIVERY_CONSULTANT, role_name: ROLE_NAMES.delivery_consultant },
      { name: '赵六', role: ROLES.DELIVERY_CONSULTANT, role_name: ROLE_NAMES.delivery_consultant },
      { name: '王总', role: ROLES.CS_LEAD, role_name: ROLE_NAMES.cs_lead },
    ];
  });

  fastify.get('/api/me', async (req, reply) => {
    return { name: req.user.name, role: req.user.role, role_name: ROLE_NAMES[req.user.role] || req.user.role };
  });
}
