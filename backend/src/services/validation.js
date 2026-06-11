import { STATUS_TRANSITIONS, REQUIRED_ATTACHMENTS, STATUS, ABNORMAL_TYPES, ROLES } from '../config.js';
import { getQuery, allQuery, runQuery } from '../db.js';
import dayjs from 'dayjs';

export function validateStatusTransition(role, currentStatus, targetStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[role]?.[currentStatus];
  
  if (!allowedTransitions) {
    return {
      valid: false,
      error: `当前角色无权处理状态为"${currentStatus}"的线索单`
    };
  }

  if (!allowedTransitions.includes(targetStatus)) {
    return {
      valid: false,
      error: `状态流转不合法：无法从"${currentStatus}"转换为"${targetStatus}"`
    };
  }

  return { valid: true };
}

export function validateVersion(clueId, submittedVersion) {
  const clue = getQuery('SELECT version FROM clues WHERE id = ?', [clueId]);
  
  if (!clue) {
    return { valid: false, error: '线索单不存在' };
  }

  if (clue.version !== submittedVersion) {
    return {
      valid: false,
      error: `版本冲突：当前版本为${clue.version}，您提交的版本为${submittedVersion}，请刷新后重试`
    };
  }

  return { valid: true, currentVersion: clue.version };
}

export function validateHandler(clueId, userId) {
  const clue = getQuery(`
    SELECT c.current_handler_id, c.status, u.name as handler_name
    FROM clues c
    LEFT JOIN users u ON c.current_handler_id = u.id
    WHERE c.id = ?
  `, [clueId]);

  if (!clue) {
    return { valid: false, error: '线索单不存在' };
  }

  if (clue.current_handler_id && clue.current_handler_id !== userId) {
    return {
      valid: false,
      error: `当前处理人为"${clue.handler_name}"，您无权处理此线索单`
    };
  }

  return { valid: true };
}

export function validateRequiredAttachments(clueId, targetStatus) {
  const requiredTypes = REQUIRED_ATTACHMENTS[targetStatus];
  
  if (!requiredTypes || requiredTypes.length === 0) {
    return { valid: true };
  }

  const attachments = allQuery(`
    SELECT attachment_type FROM attachments WHERE clue_id = ?
  `, [clueId]);

  const existingTypes = attachments.map(a => a.attachment_type);
  const missingTypes = requiredTypes.filter(type => !existingTypes.includes(type));

  if (missingTypes.length > 0) {
    return {
      valid: false,
      error: `缺少必填附件：${missingTypes.join('、')}`,
      missingTypes
    };
  }

  return { valid: true };
}

export function isOverdue(deadline) {
  if (!deadline) return false;
  return dayjs().isAfter(dayjs(deadline));
}

export function getExpiryStatus(deadline) {
  if (!deadline) return { status: 'normal', daysLeft: null };
  
  const now = dayjs();
  const deadlineDate = dayjs(deadline);
  const daysLeft = deadlineDate.diff(now, 'day');

  if (daysLeft < 0) {
    return { status: 'overdue', daysLeft };
  } else if (daysLeft <= 3) {
    return { status: 'urgent', daysLeft };
  } else {
    return { status: 'normal', daysLeft };
  }
}

export function validateAction(clueId, userId, userRole, submittedVersion, targetStatus) {
  const clue = getQuery(`
    SELECT c.id, c.clue_no, c.status, c.current_handler_id, c.version, c.deadline,
           c.responsible_person_id, c.abnormal_tags
    FROM clues c WHERE c.id = ?
  `, [clueId]);

  if (!clue) {
    return { valid: false, error: '线索单不存在', clue: null };
  }

  if (targetStatus) {
    const statusValidation = validateStatusTransition(userRole, clue.status, targetStatus);
    if (!statusValidation.valid) {
      logAbnormal(clueId, ABNORMAL_TYPES.STATUS_CONFLICT, statusValidation.error, userId);
      return { ...statusValidation, clue };
    }
  }

  const versionValidation = validateVersion(clueId, submittedVersion);
  if (!versionValidation.valid) {
    logAbnormal(clueId, ABNORMAL_TYPES.VERSION_CONFLICT, versionValidation.error, userId);
    return { ...versionValidation, clue };
  }

  const handlerValidation = validateHandler(clueId, userId);
  if (!handlerValidation.valid) {
    return { ...handlerValidation, clue };
  }

  if (targetStatus) {
    const attachmentValidation = validateRequiredAttachments(clueId, targetStatus);
    if (!attachmentValidation.valid) {
      logAbnormal(clueId, ABNORMAL_TYPES.MISSING_MATERIAL, attachmentValidation.error, userId);
      return { ...attachmentValidation, clue };
    }
  }

  if (isOverdue(clue.deadline)) {
    logAbnormal(clueId, ABNORMAL_TYPES.OVERDUE, 
      `线索单已逾期，截止时间：${clue.deadline}`, 
      null
    );
  }

  return { valid: true, clue, currentVersion: clue.version };
}

export function logAbnormal(clueId, abnormalType, description, operatorId, requestData = null) {
  try {
    runQuery(`
      INSERT INTO abnormal_logs (clue_id, abnormal_type, description, operator_id, request_data)
      VALUES (?, ?, ?, ?, ?)
    `, [clueId, abnormalType, description, operatorId, requestData ? JSON.stringify(requestData) : null]);
  } catch (e) {
    console.error('记录异常日志失败:', e);
  }
}

export function getNextHandler(role, targetStatus) {
  if (targetStatus === STATUS.PENDING_AUDIT || targetStatus === STATUS.RETURNED) {
    return null;
  }
  
  if (targetStatus === STATUS.PENDING_REVIEW) {
    const reviewers = allQuery("SELECT id FROM users WHERE role = ?", [ROLES.REVIEWER]);
    return reviewers.length > 0 ? reviewers[0].id : null;
  }

  return null;
}

export function updateAbnormalTags(clueId) {
  const clue = getQuery('SELECT deadline, status FROM clues WHERE id = ?', [clueId]);
  if (!clue) return;

  const tags = [];

  if (isOverdue(clue.deadline) && ![STATUS.ARCHIVED, STATUS.APPROVED, STATUS.REJECTED].includes(clue.status)) {
    tags.push('overdue');
  }

  const attachments = allQuery('SELECT attachment_type FROM attachments WHERE clue_id = ?', [clueId]);
  const requiredTypes = REQUIRED_ATTACHMENTS[clue.status];
  if (requiredTypes) {
    const existingTypes = attachments.map(a => a.attachment_type);
    const missingTypes = requiredTypes.filter(type => !existingTypes.includes(type));
    if (missingTypes.length > 0) {
      tags.push('missing_material');
    }
  }

  runQuery('UPDATE clues SET abnormal_tags = ? WHERE id = ?', [JSON.stringify(tags), clueId]);
}
