const { STATUS, ROLES, WARNING_THRESHOLD_DAYS } = require('../config');
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function validateWorkorderExistence(workorderId) {
  const wo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(workorderId);
  if (!wo) {
    return { valid: false, error: '工单不存在', code: 'NOT_FOUND' };
  }
  return { valid: true, workorder: wo };
}

function validateVersion(workorder, expectedVersion) {
  if (workorder.version !== expectedVersion) {
    return {
      valid: false,
      error: `版本冲突：当前版本为 ${workorder.version}，您提交的是版本 ${expectedVersion}`,
      code: 'VERSION_CONFLICT'
    };
  }
  return { valid: true };
}

function validateHandler(workorder, userRole, username) {
  if (workorder.current_handler_role && workorder.current_handler_role !== userRole) {
    return {
      valid: false,
      error: '当前处理人角色不匹配',
      code: 'ROLE_MISMATCH'
    };
  }
  if (workorder.current_handler && workorder.current_handler !== username) {
    return {
      valid: false,
      error: '当前处理人不匹配，请确认您是该工单的处理人',
      code: 'HANDLER_MISMATCH'
    };
  }
  return { valid: true };
}

function validateRequiredEvidence(workorder, action) {
  const missing = [];

  if (action === 'submit_for_review' || action === 'batch_submit') {
    if (!workorder.production_schedule) missing.push('生产排程');
    if (!workorder.material_issue) missing.push('领料确认');
    if (!workorder.completion_report) missing.push('完工报工');
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必填证据：${missing.join('、')}`,
      code: 'MISSING_EVIDENCE',
      missing
    };
  }
  return { valid: true };
}

function canPerformAction(workorder, action, userRole) {
  const status = workorder.status;

  const allowedActions = {
    [STATUS.PENDING_CORRECTION]: {
      [ROLES.PLANNER]: ['schedule_production', 'issue_material', 'report_completion', 'submit_for_review', 'add_audit_note']
    },
    [STATUS.UNDER_REVIEW]: {
      [ROLES.WORKSHOP_DIRECTOR]: ['review_approve', 'review_reject', 'add_audit_note'],
      [ROLES.FACTORY_MANAGER]: ['factory_confirm', 'add_audit_note']
    },
    [STATUS.COMPLETED]: {
      [ROLES.PLANNER]: ['view', 'add_audit_note'],
      [ROLES.WORKSHOP_DIRECTOR]: ['view', 'add_audit_note'],
      [ROLES.FACTORY_MANAGER]: ['view', 'add_audit_note']
    }
  };

  const actions = allowedActions[status]?.[userRole] || [];

  if (!actions.includes(action) && !actions.includes('view')) {
    return {
      valid: false,
      error: `当前状态下${userRole}无权执行该操作`,
      code: 'ACTION_NOT_ALLOWED'
    };
  }

  return { valid: true };
}

function getWarningLevel(deadline) {
  if (!deadline) return 'normal';

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'overdue';
  if (diffDays <= WARNING_THRESHOLD_DAYS) return 'warning';
  return 'normal';
}

function getCurrentNode(workorder) {
  if (!workorder.production_schedule) return '生产排程';
  if (!workorder.material_issue) return '领料确认';
  if (!workorder.completion_report) return '完工报工';
  if (workorder.status === STATUS.UNDER_REVIEW) return '复核确认';
  if (workorder.status === STATUS.COMPLETED) return '已办结';
  return '待处理';
}

function getNodeResponsible(workorder) {
  const node = getCurrentNode(workorder);
  const nodeResponsibleMap = {
    '生产排程': { role: ROLES.PLANNER, person: workorder.planner },
    '领料确认': { role: ROLES.WORKSHOP_DIRECTOR, person: workorder.workshop_director },
    '完工报工': { role: ROLES.WORKSHOP_DIRECTOR, person: workorder.workshop_director },
    '复核确认': { role: ROLES.FACTORY_MANAGER, person: workorder.factory_manager }
  };
  return nodeResponsibleMap[node] || { role: null, person: null };
}

function createProcessingRecord(workorderId, action, fromStatus, toStatus, operatorRole, operator, remark, evidence, versionBefore, versionAfter) {
  const id = 'rec_' + uuidv4().slice(0, 8);
  const stmt = db.prepare(`
    INSERT INTO processing_records (
      id, workorder_id, action, from_status, to_status,
      operator_role, operator, remark, evidence, version_before, version_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, workorderId, action, fromStatus, toStatus, operatorRole, operator, remark,
    evidence ? JSON.stringify(evidence) : null, versionBefore, versionAfter);
  return id;
}

function createException(workorderId, type, reason, node, responsibleRole, responsiblePerson) {
  const id = 'exc_' + uuidv4().slice(0, 8);
  const stmt = db.prepare(`
    INSERT INTO exceptions (
      id, workorder_id, type, reason, node,
      responsible_role, responsible_person
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, workorderId, type, reason, node, responsibleRole, responsiblePerson);
  return id;
}

function updateWorkorderStatus(workorderId, newStatus, newHandlerRole, newHandler, version) {
  const newVersion = version + 1;
  const stmt = db.prepare(`
    UPDATE workorders SET
      status = ?,
      current_handler_role = ?,
      current_handler = ?,
      version = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(newStatus, newHandlerRole, newHandler, newVersion, workorderId);
  return newVersion;
}

module.exports = {
  validateWorkorderExistence,
  validateVersion,
  validateHandler,
  validateRequiredEvidence,
  canPerformAction,
  getWarningLevel,
  getCurrentNode,
  getNodeResponsible,
  createProcessingRecord,
  createException,
  updateWorkorderStatus
};
