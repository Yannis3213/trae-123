const db = require('../db/database');
const { STATUS, ROLES, STATUS_NAMES, ROLE_NAMES, WARNING_THRESHOLD_DAYS } = require('../config');
const { getWarningLevel, getCurrentNode, getNodeResponsible } = require('../utils/workorderUtils');
const { parseJsonField, formatWorkorder } = require('../controllers/workorderController');

function getStatistics(req, res) {
  const userRole = req.user.role;
  const username = req.user.username;

  const totalStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_correction,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as under_review,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed
    FROM workorders
  `).get(STATUS.PENDING_CORRECTION, STATUS.UNDER_REVIEW, STATUS.COMPLETED);

  const myStats = db.prepare(`
    SELECT
      COUNT(*) as my_total,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as my_pending,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as my_processing,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as my_completed
    FROM workorders
    WHERE current_handler = ? OR planner = ? OR workshop_director = ? OR factory_manager = ?
  `).get(STATUS.PENDING_CORRECTION, STATUS.UNDER_REVIEW, STATUS.COMPLETED,
       username, username, username, username);

  const overdueCount = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM workorders
    WHERE status != ?
    AND deadline IS NOT NULL
    AND deadline < datetime('now')
  `).get(STATUS.COMPLETED).cnt;

  const warningCount = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM workorders
    WHERE status != ?
    AND deadline IS NOT NULL
    AND deadline >= datetime('now')
    AND deadline <= datetime('now', '+' || ? || ' days')
  `).get(STATUS.COMPLETED, WARNING_THRESHOLD_DAYS).cnt;

  res.json({
    success: true,
    data: {
      total: totalStats,
      mine: myStats,
      overdue: overdueCount,
      warning: warningCount
    }
  });
}

function getWarningList(req, res) {
  const { level, page = 1, pageSize = 20 } = req.query;
  const userRole = req.user.role;
  const username = req.user.username;

  let whereClause = `WHERE status != ?`;
  const params = [STATUS.COMPLETED];

  if (level === 'overdue') {
    whereClause += ` AND deadline < datetime('now')`;
  } else if (level === 'warning') {
    whereClause += ` AND deadline >= datetime('now') AND deadline <= datetime('now', '+' || ? || ' days')`;
    params.push(WARNING_THRESHOLD_DAYS);
  }

  const query = `SELECT * FROM workorders ${whereClause} ORDER BY deadline ASC LIMIT ? OFFSET ?`;
  const listParams = [...params, parseInt(pageSize), parseInt((page - 1) * pageSize)];

  const getExceptions = db.prepare(`
    SELECT * FROM exceptions WHERE workorder_id = ? ORDER BY created_at DESC
  `);
  const getAuditNotes = db.prepare(`
    SELECT * FROM audit_notes WHERE workorder_id = ? ORDER BY created_at DESC
  `);

  const workorders = db.prepare(query).all(...listParams).map(wo => {
    const formatted = formatWorkorder(wo);
    const responsible = getNodeResponsible(wo);
    const exceptions = getExceptions.all(wo.id);
    const auditNotes = getAuditNotes.all(wo.id);
    return {
      ...formatted,
      current_node: getCurrentNode(wo),
      responsible_role: responsible.role,
      responsible_role_name: responsible.role ? ROLE_NAMES[responsible.role] : null,
      responsible_person: responsible.person,
      exceptions: exceptions || [],
      latest_exception: exceptions && exceptions.length > 0 ? exceptions[0] : null,
      audit_notes_count: auditNotes ? auditNotes.length : 0
    };
  });

  const countQuery = `SELECT COUNT(*) as total FROM workorders ${whereClause}`;
  const { total } = db.prepare(countQuery).get(...params);

  const groupStats = db.prepare(`
    SELECT
      SUM(CASE WHEN deadline < datetime('now') THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN deadline >= datetime('now') AND deadline <= datetime('now', '+' || ? || ' days') THEN 1 ELSE 0 END) as warning,
      SUM(CASE WHEN deadline > datetime('now', '+' || ? || ' days') THEN 1 ELSE 0 END) as normal
    FROM workorders
    WHERE status != ?
  `).get(WARNING_THRESHOLD_DAYS, WARNING_THRESHOLD_DAYS, STATUS.COMPLETED);

  res.json({
    success: true,
    data: {
      list: workorders,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      groups: groupStats
    }
  });
}

function getNodeStatistics(req, res) {
  const pendingList = db.prepare(`
    SELECT * FROM workorders WHERE status = ?
  `).all(STATUS.PENDING_CORRECTION);

  const nodeStats = {
    schedule: 0,
    material: 0,
    completion: 0,
    review: 0
  };

  for (const wo of pendingList) {
    if (!wo.production_schedule) {
      nodeStats.schedule++;
    } else if (!wo.material_issue) {
      nodeStats.material++;
    } else if (!wo.completion_report) {
      nodeStats.completion++;
    } else {
      nodeStats.review++;
    }
  }

  const underReviewCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM workorders WHERE status = ?
  `).get(STATUS.UNDER_REVIEW).cnt;

  res.json({
    success: true,
    data: {
      pending_nodes: nodeStats,
      under_review: underReviewCount
    }
  });
}

module.exports = {
  getStatistics,
  getWarningList,
  getNodeStatistics
};
