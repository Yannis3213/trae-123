import { getQuery, allQuery, runQuery, beginTransaction, commitTransaction, rollbackTransaction } from '../db.js';
import { validateAction, logAbnormal, getNextHandler, updateAbnormalTags, getExpiryStatus, isOverdue } from './validation.js';
import { STATUS, ROLES, ABNORMAL_TYPES } from '../config.js';
import dayjs from 'dayjs';

export function getClueList(user, filters = {}) {
  const { status, priority, clue_type, keyword, expiryStatus } = filters;
  
  let sql = `
    SELECT 
      c.id, c.clue_no, c.title, c.clue_type, c.priority, c.status,
      c.enterprise_name, c.amount, c.deadline, c.abnormal_tags,
      c.created_at, c.updated_at, c.version,
      rp.name as responsible_person,
      ch.name as current_handler,
      creator.name as created_by_name
    FROM clues c
    LEFT JOIN users rp ON c.responsible_person_id = rp.id
    LEFT JOIN users ch ON c.current_handler_id = ch.id
    LEFT JOIN users creator ON c.created_by = creator.id
    WHERE 1=1
  `;
  
  const params = [];

  if (user.role === ROLES.REGISTRAR) {
    sql += ' AND c.created_by = ?';
    params.push(user.id);
  } else if (user.role === ROLES.AUDITOR) {
    sql += ' AND (c.current_handler_id = ? OR c.status IN (?, ?))';
    params.push(user.id, STATUS.PENDING_AUDIT, STATUS.RESUBMITTED);
  } else if (user.role === ROLES.REVIEWER) {
    sql += ' AND c.status IN (?, ?, ?, ?)';
    params.push(STATUS.PENDING_REVIEW, STATUS.APPROVED, STATUS.REJECTED, STATUS.ARCHIVED);
  }

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  if (priority) {
    sql += ' AND c.priority = ?';
    params.push(priority);
  }

  if (clue_type) {
    sql += ' AND c.clue_type = ?';
    params.push(clue_type);
  }

  if (keyword) {
    sql += ' AND (c.title LIKE ? OR c.enterprise_name LIKE ? OR c.clue_no LIKE ?)';
    const searchTerm = `%${keyword}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  sql += ' ORDER BY c.priority DESC, c.created_at DESC';

  let clues = allQuery(sql, params);

  clues = clues.map(clue => {
    const expiry = getExpiryStatus(clue.deadline);
    const abnormalTags = JSON.parse(clue.abnormal_tags || '[]');
    
    if (expiry.status === 'overdue' && !abnormalTags.includes('overdue')) {
      abnormalTags.push('overdue');
    }
    
    return {
      ...clue,
      expiry_status: expiry.status,
      days_left: expiry.daysLeft,
      abnormal_tags: abnormalTags
    };
  });

  if (expiryStatus) {
    clues = clues.filter(c => c.expiry_status === expiryStatus);
  }

  return clues;
}

export function getClueDetail(clueId, user) {
  const clue = getQuery(`
    SELECT 
      c.*,
      rp.name as responsible_person_name,
      ch.name as current_handler_name,
      creator.name as created_by_name
    FROM clues c
    LEFT JOIN users rp ON c.responsible_person_id = rp.id
    LEFT JOIN users ch ON c.current_handler_id = ch.id
    LEFT JOIN users creator ON c.created_by = creator.id
    WHERE c.id = ?
  `, [clueId]);

  if (!clue) {
    return null;
  }

  if (user.role === ROLES.REGISTRAR && clue.created_by !== user.id) {
    return { error: '无权查看此线索单', code: 403 };
  }

  const attachments = allQuery(`
    SELECT a.*, u.name as uploaded_by_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.clue_id = ?
    ORDER BY a.created_at DESC
  `, [clueId]);

  const processingRecords = allQuery(`
    SELECT pr.*, u.name as operator_name
    FROM processing_records pr
    LEFT JOIN users u ON pr.operator_id = u.id
    WHERE pr.clue_id = ?
    ORDER BY pr.created_at DESC
  `, [clueId]);

  const auditNotes = allQuery(`
    SELECT an.*, u.name as auditor_name
    FROM audit_notes an
    LEFT JOIN users u ON an.auditor_id = u.id
    WHERE an.clue_id = ?
    ORDER BY an.created_at DESC
  `, [clueId]);

  const abnormalLogs = allQuery(`
    SELECT al.*, u.name as operator_name
    FROM abnormal_logs al
    LEFT JOIN users u ON al.operator_id = u.id
    WHERE al.clue_id = ?
    ORDER BY al.created_at DESC
  `, [clueId]);

  const expiry = getExpiryStatus(clue.deadline);
  const abnormalTags = JSON.parse(clue.abnormal_tags || '[]');
  
  if (expiry.status === 'overdue' && !abnormalTags.includes('overdue')) {
    abnormalTags.push('overdue');
  }

  return {
    ...clue,
    abnormal_tags: abnormalTags,
    expiry_status: expiry.status,
    days_left: expiry.daysLeft,
    attachments,
    processing_records: processingRecords,
    audit_notes: auditNotes,
    abnormal_logs: abnormalLogs
  };
}

export function processClue(clueId, actionData, user) {
  const { target_status, remark, return_reason, version, action } = actionData;

  beginTransaction();

  try {
    const validation = validateAction(clueId, user.id, user.role, version, target_status);
    
    if (!validation.valid) {
      rollbackTransaction();
      return { success: false, message: validation.error, code: 400 };
    }

    const { clue, currentVersion } = validation;

    if (target_status === STATUS.RETURNED && !return_reason) {
      rollbackTransaction();
      return { success: false, message: '退回操作必须填写退回原因', code: 400 };
    }

    const nextHandlerId = getNextHandler(user.role, target_status, clue);

    runQuery(`
      UPDATE clues 
      SET status = ?, 
          version = ?, 
          current_handler_id = ?,
          return_reason = ?,
          audit_remark = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      target_status,
      currentVersion + 1,
      nextHandlerId,
      return_reason || null,
      remark || null,
      clueId
    ]);

    runQuery(`
      INSERT INTO processing_records (
        clue_id, from_status, to_status, action, result, remark, operator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      clueId,
      clue.status,
      target_status,
      action,
      'success',
      remark || '',
      user.id
    ]);

    updateAbnormalTags(clueId);

    commitTransaction();

    return {
      success: true,
      message: '操作成功',
      data: {
        clue_id: clueId,
        new_status: target_status,
        new_version: currentVersion + 1
      }
    };
  } catch (error) {
    rollbackTransaction();
    logAbnormal(clueId, ABNORMAL_TYPES.STATUS_CONFLICT, 
      `处理线索单失败: ${error.message}`, 
      user.id, 
      actionData
    );
    return { success: false, message: '操作失败：' + error.message, code: 500 };
  }
}

export function processBatch(items, actionData, user) {
  const batchNo = 'BATCH' + dayjs().format('YYYYMMDDHHmmss');
  const results = [];

  for (const item of items) {
    const { clue_id, version } = item;
    const { target_status, remark, return_reason, action } = actionData;

    let resultRecord = {
      clue_id,
      clue_no: null,
      success: false,
      error_code: null,
      error_message: null,
      from_status: null,
      to_status: target_status,
      old_version: version,
      new_version: null,
      abnormal_type: null,
      processing_record_id: null
    };

    try {
      const clue = getQuery('SELECT id, clue_no, status, deadline, current_handler_id, created_by, responsible_person_id, version FROM clues WHERE id = ?', [clue_id]);

      if (!clue) {
        resultRecord.error_code = 'NOT_FOUND';
        resultRecord.error_message = '线索单不存在';
        results.push(resultRecord);
        continue;
      }

      resultRecord.clue_no = clue.clue_no;
      resultRecord.from_status = clue.status;
      resultRecord.old_version = clue.version;

      if (isOverdue(clue.deadline)) {
        const abnormalDesc = `批量处理时发现逾期：线索单${clue.clue_no}已逾期，截止时间：${clue.deadline}`;
        logAbnormal(clue_id, ABNORMAL_TYPES.OVERDUE, abnormalDesc, user.id);
        resultRecord.error_code = 'OVERDUE';
        resultRecord.error_message = '线索单已逾期，请先进入详情页处理逾期问题，节点超时落到责任人处理';
        resultRecord.abnormal_type = ABNORMAL_TYPES.OVERDUE;
        results.push(resultRecord);
        continue;
      }

      const validation = validateAction(clue_id, user.id, user.role, version, target_status);

      if (!validation.valid) {
        let errorCode = 'VALIDATION_FAILED';
        let abnormalType = null;
        if (validation.error?.includes('版本冲突')) {
          errorCode = 'VERSION_CONFLICT';
          abnormalType = ABNORMAL_TYPES.VERSION_CONFLICT;
        } else if (validation.error?.includes('无权') || validation.error?.includes('处理人')) {
          errorCode = 'PERMISSION_DENIED';
        } else if (validation.error?.includes('状态')) {
          errorCode = 'STATUS_CONFLICT';
          abnormalType = ABNORMAL_TYPES.STATUS_CONFLICT;
        } else if (validation.error?.includes('附件') || validation.error?.includes('材料')) {
          errorCode = 'MISSING_MATERIAL';
          abnormalType = ABNORMAL_TYPES.MISSING_MATERIAL;
        }

        if (abnormalType) {
          logAbnormal(clue_id, abnormalType, validation.error, user.id, actionData);
        }

        resultRecord.error_code = errorCode;
        resultRecord.error_message = validation.error;
        resultRecord.abnormal_type = abnormalType;
        results.push(resultRecord);
        continue;
      }

      beginTransaction();

      try {
        const { currentVersion, clue: validClue } = validation;

        if (target_status === STATUS.RETURNED && !return_reason) {
          throw new Error('退回操作必须填写退回原因');
        }

        const nextHandlerId = getNextHandler(user.role, target_status, validClue);

        runQuery(`
          UPDATE clues 
          SET status = ?, version = ?, current_handler_id = ?,
              return_reason = ?, audit_remark = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          target_status,
          currentVersion + 1,
          nextHandlerId,
          return_reason || null,
          remark || null,
          clue_id
        ]);

        const recordResult = runQuery(`
          INSERT INTO processing_records (
            clue_id, from_status, to_status, action, result, remark, operator_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          clue_id,
          validClue.status,
          target_status,
          action,
          'success',
          remark || '',
          user.id
        ]);

        const processingRecordId = recordResult?.lastInsertRowid || null;

        if (target_status === STATUS.RETURNED && return_reason) {
          const auditNoteContent = `【批量退回】退回原因：${return_reason}${remark ? `\n备注：${remark}` : ''}`;
          runQuery(`
            INSERT INTO audit_notes (clue_id, note, auditor_id)
            VALUES (?, ?, ?)
          `, [
            clue_id,
            auditNoteContent,
            user.id
          ]);
        }

        updateAbnormalTags(clue_id);

        commitTransaction();

        resultRecord.success = true;
        resultRecord.to_status = target_status;
        resultRecord.new_version = currentVersion + 1;
        resultRecord.processing_record_id = processingRecordId;
        resultRecord.error_code = null;
        resultRecord.error_message = null;
        results.push(resultRecord);
      } catch (e) {
        rollbackTransaction();
        logAbnormal(clue_id, ABNORMAL_TYPES.STATUS_CONFLICT,
          `批量处理失败: ${e.message}`,
          user.id,
          actionData
        );
        resultRecord.error_code = 'PROCESS_ERROR';
        resultRecord.error_message = e.message;
        resultRecord.abnormal_type = ABNORMAL_TYPES.STATUS_CONFLICT;
        results.push(resultRecord);
      }
    } catch (e) {
      resultRecord.error_code = 'SYSTEM_ERROR';
      resultRecord.error_message = e.message;
      results.push(resultRecord);
    }
  }

  for (const result of results) {
    runQuery(`
      INSERT INTO batch_results (
        batch_no, clue_id, clue_no, success, error_code, error_message,
        from_status, to_status, old_version, new_version,
        abnormal_type, processing_record_id, operator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      batchNo,
      result.clue_id,
      result.clue_no,
      result.success ? 1 : 0,
      result.error_code,
      result.error_message,
      result.from_status,
      result.to_status,
      result.old_version,
      result.new_version,
      result.abnormal_type,
      result.processing_record_id,
      user.id
    ]);
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  return {
    batch_no: batchNo,
    total: results.length,
    success_count: successCount,
    fail_count: failCount,
    results
  };
}

export function addAuditNote(clueId, note, user) {
  if (![ROLES.AUDITOR, ROLES.REVIEWER].includes(user.role)) {
    return { success: false, message: '只有审核和复核人员可以添加审计备注', code: 403 };
  }

  runQuery(`
    INSERT INTO audit_notes (clue_id, note, auditor_id)
    VALUES (?, ?, ?)
  `, [clueId, note, user.id]);

  return { success: true, message: '备注添加成功' };
}

export function getStatistics(user) {
  let baseSql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending_submit' THEN 1 ELSE 0 END) as pending_submit,
      SUM(CASE WHEN status = 'pending_audit' THEN 1 ELSE 0 END) as pending_audit,
      SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned,
      SUM(CASE WHEN status = 'resubmitted' THEN 1 ELSE 0 END) as resubmitted,
      SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
      SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority
    FROM clues
    WHERE 1=1
  `;

  const params = [];

  if (user.role === ROLES.REGISTRAR) {
    baseSql += ' AND created_by = ?';
    params.push(user.id);
  } else if (user.role === ROLES.AUDITOR) {
    baseSql += ' AND (current_handler_id = ? OR status IN (?, ?))';
    params.push(user.id, STATUS.PENDING_AUDIT, STATUS.RESUBMITTED);
  } else if (user.role === ROLES.REVIEWER) {
    baseSql += ' AND status IN (?, ?, ?, ?)';
    params.push(STATUS.PENDING_REVIEW, STATUS.APPROVED, STATUS.REJECTED, STATUS.ARCHIVED);
  }

  const stats = getQuery(baseSql, params);

  const allClues = allQuery('SELECT deadline, status FROM clues WHERE 1=1', []);
  let overdue = 0;
  let urgent = 0;

  for (const clue of allClues) {
    if (clue.deadline && ![STATUS.ARCHIVED, STATUS.APPROVED, STATUS.REJECTED].includes(clue.status)) {
      const expiry = getExpiryStatus(clue.deadline);
      if (expiry.status === 'overdue') overdue++;
      else if (expiry.status === 'urgent') urgent++;
    }
  }

  return {
    ...stats,
    overdue,
    urgent
  };
}

export function getAbnormalLogs(clueId) {
  return allQuery(`
    SELECT al.*, u.name as operator_name
    FROM abnormal_logs al
    LEFT JOIN users u ON al.operator_id = u.id
    WHERE al.clue_id = ?
    ORDER BY al.created_at DESC
  `, [clueId]);
}

export function getBatchResults(batchNo) {
  return allQuery(`
    SELECT br.*, c.clue_no as current_clue_no, c.status as current_status, 
           c.version as current_version, c.title,
           u.name as operator_name,
           from_u.name as from_status_label,
           to_u.name as to_status_label
    FROM batch_results br
    LEFT JOIN clues c ON br.clue_id = c.id
    LEFT JOIN users u ON br.operator_id = u.id
    WHERE br.batch_no = ?
    ORDER BY br.id ASC
  `, [batchNo]);
}
