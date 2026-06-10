const db = require('../db/database');
const { STATUS, ROLES, STATUS_NAMES } = require('../config');
const {
  validateWorkorderExistence,
  validateVersion,
  validateHandler,
  validateRequiredEvidence,
  createProcessingRecord,
  updateWorkorderStatus
} = require('../utils/workorderUtils');
const { formatWorkorder } = require('../controllers/workorderController');

function batchSubmitForReview(req, res) {
  const { items } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '请选择要批量提交的工单', code: 'EMPTY_BATCH' });
  }

  if (userRole !== ROLES.PLANNER) {
    return res.status(403).json({ success: false, error: '只有生产计划员可以批量提交复核', code: 'PERMISSION_DENIED' });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  const processOne = (item) => {
    const { id, version } = item;

    try {
      const validation = validateWorkorderExistence(id);
      if (!validation.valid) {
        failCount++;
        return {
          id,
          success: false,
          error: validation.error,
          error_code: validation.code
        };
      }

      const wo = validation.workorder;

      const versionCheck = validateVersion(wo, version);
      if (!versionCheck.valid) {
        failCount++;
        return {
          id,
          code: wo.code,
          success: false,
          error: versionCheck.error,
          error_code: versionCheck.code
        };
      }

      const handlerCheck = validateHandler(wo, userRole, username);
      if (!handlerCheck.valid) {
        failCount++;
        return {
          id,
          code: wo.code,
          success: false,
          error: handlerCheck.error,
          error_code: handlerCheck.code
        };
      }

      const evidenceCheck = validateRequiredEvidence(wo, 'batch_submit');
      if (!evidenceCheck.valid) {
        failCount++;
        return {
          id,
          code: wo.code,
          success: false,
          error: evidenceCheck.error,
          error_code: evidenceCheck.code,
          missing: evidenceCheck.missing
        };
      }

      if (wo.status !== STATUS.PENDING_CORRECTION) {
        failCount++;
        return {
          id,
          code: wo.code,
          success: false,
          error: `当前状态为「${STATUS_NAMES[wo.status]}」，无法提交复核`,
          error_code: 'STATUS_ERROR'
        };
      }

      const newVersion = updateWorkorderStatus(
        id, STATUS.UNDER_REVIEW, ROLES.WORKSHOP_DIRECTOR, wo.workshop_director, version
      );

      createProcessingRecord(
        id, '批量提交复核', STATUS.PENDING_CORRECTION, STATUS.UNDER_REVIEW,
        userRole, username, '批量提交复核', null, version, newVersion
      );

      successCount++;
      return {
        id,
        code: wo.code,
        success: true,
        message: '提交成功'
      };
    } catch (e) {
      failCount++;
      return {
        id,
        success: false,
        error: '系统错误：' + e.message,
        error_code: 'SYSTEM_ERROR'
      };
    }
  };

  for (const item of items) {
    results.push(processOne(item));
  }

  res.json({
    success: true,
    data: {
      total: items.length,
      success_count: successCount,
      fail_count: failCount,
      results
    }
  });
}

function batchReview(req, res) {
  const { items, action, remark } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '请选择要批量处理的工单', code: 'EMPTY_BATCH' });
  }

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, error: '无效的批量操作类型', code: 'INVALID_ACTION' });
  }

  if (userRole !== ROLES.WORKSHOP_DIRECTOR) {
    return res.status(403).json({ success: false, error: '只有车间主任可以批量复核', code: 'PERMISSION_DENIED' });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    const { id, version, reject_reason } = item;

    try {
      const validation = validateWorkorderExistence(id);
      if (!validation.valid) {
        failCount++;
        results.push({ id, success: false, error: validation.error, error_code: validation.code });
        continue;
      }

      const wo = validation.workorder;

      const versionCheck = validateVersion(wo, version);
      if (!versionCheck.valid) {
        failCount++;
        results.push({ id, code: wo.code, success: false, error: versionCheck.error, error_code: versionCheck.code });
        continue;
      }

      if (wo.status !== STATUS.UNDER_REVIEW) {
        failCount++;
        results.push({
          id, code: wo.code, success: false,
          error: `当前状态为「${STATUS_NAMES[wo.status]}」，无法复核`,
          error_code: 'STATUS_ERROR'
        });
        continue;
      }

      if (wo.workshop_director !== username) {
        failCount++;
        results.push({
          id, code: wo.code, success: false,
          error: '您不是该工单的车间主任',
          error_code: 'HANDLER_MISMATCH'
        });
        continue;
      }

      if (action === 'approve') {
        const newVersion = updateWorkorderStatus(
          id, STATUS.UNDER_REVIEW, ROLES.FACTORY_MANAGER, wo.factory_manager, version
        );
        createProcessingRecord(
          id, '批量复核通过', STATUS.UNDER_REVIEW, STATUS.UNDER_REVIEW,
          userRole, username, remark || '批量复核通过', null, version, newVersion
        );
        successCount++;
        results.push({ id, code: wo.code, success: true, message: '复核通过' });
      } else {
        if (!reject_reason && !remark) {
          failCount++;
          results.push({
            id, code: wo.code, success: false,
            error: '请填写退回原因',
            error_code: 'MISSING_REASON'
          });
          continue;
        }
        const newVersion = updateWorkorderStatus(
          id, STATUS.PENDING_CORRECTION, ROLES.PLANNER, wo.planner, version
        );
        createProcessingRecord(
          id, '批量退回补正', STATUS.UNDER_REVIEW, STATUS.PENDING_CORRECTION,
          userRole, username, reject_reason || remark, { reject_reason: reject_reason || remark },
          version, newVersion
        );
        successCount++;
        results.push({ id, code: wo.code, success: true, message: '已退回补正' });
      }
    } catch (e) {
      failCount++;
      results.push({ id, success: false, error: '系统错误：' + e.message, error_code: 'SYSTEM_ERROR' });
    }
  }

  res.json({
    success: true,
    data: {
      total: items.length,
      success_count: successCount,
      fail_count: failCount,
      results
    }
  });
}

function batchFactoryConfirm(req, res) {
  const { items, remark } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: '请选择要批量确认的工单', code: 'EMPTY_BATCH' });
  }

  if (userRole !== ROLES.FACTORY_MANAGER) {
    return res.status(403).json({ success: false, error: '只有厂务经理可以批量确认办结', code: 'PERMISSION_DENIED' });
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const item of items) {
    const { id, version } = item;

    try {
      const validation = validateWorkorderExistence(id);
      if (!validation.valid) {
        failCount++;
        results.push({ id, success: false, error: validation.error, error_code: validation.code });
        continue;
      }

      const wo = validation.workorder;

      const versionCheck = validateVersion(wo, version);
      if (!versionCheck.valid) {
        failCount++;
        results.push({ id, code: wo.code, success: false, error: versionCheck.error, error_code: versionCheck.code });
        continue;
      }

      if (wo.status !== STATUS.UNDER_REVIEW) {
        failCount++;
        results.push({
          id, code: wo.code, success: false,
          error: `当前状态为「${STATUS_NAMES[wo.status]}」，无法确认办结`,
          error_code: 'STATUS_ERROR'
        });
        continue;
      }

      if (wo.factory_manager !== username) {
        failCount++;
        results.push({
          id, code: wo.code, success: false,
          error: '您不是该工单的厂务经理',
          error_code: 'HANDLER_MISMATCH'
        });
        continue;
      }

      const newVersion = version + 1;
      db.prepare(`
        UPDATE workorders SET
          status = ?,
          current_handler_role = NULL,
          current_handler = NULL,
          version = ?,
          completed_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(STATUS.COMPLETED, newVersion, id);

      createProcessingRecord(
        id, '批量确认办结', STATUS.UNDER_REVIEW, STATUS.COMPLETED,
        userRole, username, remark || '批量确认办结', null, version, newVersion
      );

      successCount++;
      results.push({ id, code: wo.code, success: true, message: '已确认办结' });
    } catch (e) {
      failCount++;
      results.push({ id, success: false, error: '系统错误：' + e.message, error_code: 'SYSTEM_ERROR' });
    }
  }

  res.json({
    success: true,
    data: {
      total: items.length,
      success_count: successCount,
      fail_count: failCount,
      results
    }
  });
}

module.exports = {
  batchSubmitForReview,
  batchReview,
  batchFactoryConfirm
};
