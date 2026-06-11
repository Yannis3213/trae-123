const db = require('../utils/db');
const {
  ROLES,
  NODES,
  STATUSES,
  STATUS_LABELS,
  NODE_LABELS,
  NODE_HANDLER_ROLES,
  ROLE_LABELS,
  EXCEPTION_TYPES,
  EXCEPTION_TYPE_LABELS
} = require('../utils/constants');
const { checkTimeout } = require('../utils/workflow');

async function routes(fastify) {
  fastify.get('/alerts/deadline', { preHandler: [fastify.authenticate] }, async (request) => {
    const { group } = request.query;
    const user = request.user;

    let whereClause = 'WHERE status != ?';
    const params = [STATUSES.ARCHIVED];

    if (user.role === ROLES.MERCHANT_REGISTRAR) {
      whereClause += ` AND (
        current_node IN ('${NODES.ENTRY_REGISTRATION}', '${NODES.ENTRY_FORM_REGISTRATION}')
        OR created_by = ?
      )`;
      params.push(user.username);
    } else if (user.role === ROLES.AUDIT_SUPERVISOR) {
      whereClause += ` AND current_node = '${NODES.QUALIFICATION_AUDIT}'`;
    } else if (user.role === ROLES.PLATFORM_LEADER) {
      whereClause += ` AND current_node IN ('${NODES.FINAL_REVIEW}')`;
    }

    if (group === 'overdue') {
      whereClause += ' AND deadline IS NOT NULL AND deadline < datetime(\'now\')';
    } else if (group === 'near') {
      whereClause += ' AND deadline IS NOT NULL AND deadline >= datetime(\'now\') AND deadline <= datetime(\'now\', \'+1 day\')';
    } else if (group === 'normal') {
      whereClause += ' AND (deadline IS NULL OR deadline > datetime(\'now\', \'+1 day\'))';
    }

    const sql = `
      SELECT * FROM merchant_entry_forms
      ${whereClause}
      ORDER BY deadline ASC
    `;

    const forms = db.prepare(sql).all(...params);

    const handlerUsernames = [...new Set(forms.map(f => f.current_handler).filter(Boolean))];
    const handlers = {};

    if (handlerUsernames.length > 0) {
      const placeholders = handlerUsernames.map(() => '?').join(',');
      const users = db.prepare(`
        SELECT username, real_name, role FROM users WHERE username IN (${placeholders})
      `).all(...handlerUsernames);

      users.forEach(u => {
        handlers[u.username] = {
          realName: u.real_name,
          role: u.role,
          roleLabel: ROLE_LABELS[u.role]
        };
      });
    }

    const enhancedForms = forms.map(form => {
      const timeoutInfo = checkTimeout(form.deadline);
      const handler = form.current_handler ? handlers[form.current_handler] : null;

      return {
        ...form,
        statusLabel: STATUS_LABELS[form.status],
        currentNodeLabel: NODE_LABELS[form.current_node],
        timeoutInfo,
        currentHandlerInfo: handler,
        responsiblePerson: handler ? handler.realName : (form.previous_handler || form.created_by),
        deadlineGroup: timeoutInfo.isTimeout ? 'overdue' : (timeoutInfo.isNearDeadline ? 'near' : 'normal')
      };
    });

    const grouped = {
      normal: enhancedForms.filter(f => f.deadlineGroup === 'normal'),
      near: enhancedForms.filter(f => f.deadlineGroup === 'near'),
      overdue: enhancedForms.filter(f => f.deadlineGroup === 'overdue')
    };

    const byHandler = {};
    enhancedForms.forEach(form => {
      const handler = form.current_handler || 'unassigned';
      if (!byHandler[handler]) {
        byHandler[handler] = {
          handlerInfo: form.currentHandlerInfo || { realName: '未分配', role: null, roleLabel: '未分配' },
          total: 0,
          normal: 0,
          near: 0,
          overdue: 0,
          forms: []
        };
      }
      byHandler[handler].total++;
      byHandler[handler][form.deadlineGroup]++;
      byHandler[handler].forms.push(form);
    });

    return {
      success: true,
      data: {
        list: group ? grouped[group] : enhancedForms,
        grouped: {
          normal: { count: grouped.normal.length, items: grouped.normal },
          near: { count: grouped.near.length, items: grouped.near },
          overdue: { count: grouped.overdue.length, items: grouped.overdue }
        },
        byHandler,
        stats: {
          total: enhancedForms.length,
          normal: grouped.normal.length,
          near: grouped.near.length,
          overdue: grouped.overdue.length
        }
      }
    };
  });

  fastify.get('/alerts/exceptions', { preHandler: [fastify.authenticate] }, async (request) => {
    const { formId, resolved, exceptionType } = request.query;
    const user = request.user;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (formId) {
      whereClause += ' AND er.form_id = ?';
      params.push(formId);
    }

    if (resolved !== undefined) {
      whereClause += ' AND er.resolved = ?';
      params.push(resolved === 'true' || resolved === true ? 1 : 0);
    }

    if (exceptionType) {
      whereClause += ' AND er.exception_type = ?';
      params.push(exceptionType);
    }

    if (user.role === ROLES.MERCHANT_REGISTRAR) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM merchant_entry_forms mf
        WHERE mf.id = er.form_id
        AND (mf.current_node IN ('${NODES.ENTRY_REGISTRATION}', '${NODES.ENTRY_FORM_REGISTRATION}')
             OR mf.created_by = ?)
      )`;
      params.push(user.username);
    } else if (user.role === ROLES.AUDIT_SUPERVISOR) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM merchant_entry_forms mf
        WHERE mf.id = er.form_id
        AND mf.current_node = '${NODES.QUALIFICATION_AUDIT}'
      )`;
    }

    const sql = `
      SELECT er.*, mf.form_no, mf.merchant_name, mf.status, mf.current_node
      FROM exception_reasons er
      LEFT JOIN merchant_entry_forms mf ON er.form_id = mf.id
      ${whereClause}
      ORDER BY er.created_at DESC
    `;

    const exceptions = db.prepare(sql).all(...params);

    const enhanced = exceptions.map(e => ({
      ...e,
      formNo: e.form_no,
      merchantName: e.merchant_name,
      exceptionTypeLabel: EXCEPTION_TYPE_LABELS[e.exception_type],
      statusLabel: STATUS_LABELS[e.status],
      currentNodeLabel: NODE_LABELS[e.current_node],
      resolved: e.resolved === 1
    }));

    const stats = {
      total: enhanced.length,
      byType: {},
      unresolved: enhanced.filter(e => !e.resolved).length,
      resolved: enhanced.filter(e => e.resolved).length
    };

    Object.values(EXCEPTION_TYPES).forEach(type => {
      stats.byType[type] = enhanced.filter(e => e.exception_type === type).length;
    });

    return {
      success: true,
      data: {
        list: enhanced,
        stats
      }
    };
  });

  fastify.get('/alerts/statistics', { preHandler: [fastify.authenticate] }, async () => {
    const statsSql = `
      SELECT
        current_node,
        status,
        COUNT(*) as count,
        SUM(CASE WHEN deadline IS NOT NULL AND deadline < datetime('now') THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN deadline IS NOT NULL AND deadline >= datetime('now') AND deadline <= datetime('now', '+1 day') THEN 1 ELSE 0 END) as near_count
      FROM merchant_entry_forms
      WHERE status != ?
      GROUP BY current_node, status
    `;

    const stats = db.prepare(statsSql).get(STATUSES.ARCHIVED);

    const nodeStats = {};
    const allStats = db.prepare(statsSql).all(STATUSES.ARCHIVED);

    allStats.forEach(s => {
      if (!nodeStats[s.current_node]) {
        nodeStats[s.current_node] = {
          nodeLabel: NODE_LABELS[s.current_node],
          total: 0,
          overdue: 0,
          near: 0,
          byStatus: {}
        };
      }
      nodeStats[s.current_node].total += s.count;
      nodeStats[s.current_node].overdue += s.overdue_count;
      nodeStats[s.current_node].near += s.near_count;
      nodeStats[s.current_node].byStatus[s.status] = {
        statusLabel: STATUS_LABELS[s.status],
        count: s.count
      };
    });

    const handlerStatsSql = `
      SELECT
        current_handler,
        COUNT(*) as total,
        SUM(CASE WHEN deadline IS NOT NULL AND deadline < datetime('now') THEN 1 ELSE 0 END) as overdue
      FROM merchant_entry_forms
      WHERE status != ? AND current_handler IS NOT NULL
      GROUP BY current_handler
      ORDER BY overdue DESC
    `;

    const handlerRaw = db.prepare(handlerStatsSql).all(STATUSES.ARCHIVED);

    const handlerUsernames = handlerRaw.map(h => h.current_handler);
    const users = handlerUsernames.length > 0
      ? db.prepare(`
          SELECT username, real_name, role FROM users WHERE username IN (${handlerUsernames.map(() => '?').join(',')})
        `).all(...handlerUsernames)
      : [];

    const userMap = {};
    users.forEach(u => { userMap[u.username] = u; });

    const handlerStats = handlerRaw.map(h => ({
      username: h.current_handler,
      realName: userMap[h.current_handler]?.real_name || h.current_handler,
      role: userMap[h.current_handler]?.role,
      roleLabel: userMap[h.current_handler]?.role ? ROLE_LABELS[userMap[h.current_handler].role] : '',
      total: h.total,
      overdue: h.overdue
    }));

    return {
      success: true,
      data: {
        byNode: nodeStats,
        byHandler: handlerStats,
        summary: {
          total: allStats.reduce((sum, s) => sum + s.count, 0),
          totalOverdue: allStats.reduce((sum, s) => sum + s.overdue_count, 0),
          totalNear: allStats.reduce((sum, s) => sum + s.near_count, 0)
        }
      }
    };
  });
}

module.exports = routes;
