const dayjs = require('dayjs');
const {
  STATUS, STATUS_NAMES, ROLES, WARNING_GROUPS, WARNING_DAYS, REQUIRED_EVIDENCE_FIELDS
} = require('../config');
const {
  SideRecordModel, ProcessRecordModel, AuditNoteModel,
  AbnormalReasonModel, AttachmentModel, UserModel
} = require('../models');
const {
  validateEvidence, validateVersion, validateHandler,
  validateStatusTransition, canViewByRole, canOperateByRole
} = require('../middleware/auth');
const db = require('../db');

class SideRecordService {
  static _getNextHandler(targetStatus, record, userId) {
    if (targetStatus === STATUS.RETURNED || targetStatus === STATUS.MATERIAL_MISSING) {
      return record.registrarId;
    }
    if (targetStatus === STATUS.PENDING_REVIEW) {
      const supervisors = UserModel.findByRole(ROLES.SUPERVISOR);
      return supervisors.length > 0 ? supervisors[0].id : userId;
    }
    if (targetStatus === STATUS.REVIEW_PASSED || targetStatus === STATUS.OVERDUE) {
      const reviewers = UserModel.findByRole(ROLES.REVIEWER);
      return reviewers.length > 0 ? reviewers[0].id : userId;
    }
    if (targetStatus === STATUS.STATUS_CONFLICT) {
      return userId;
    }
    if (targetStatus === STATUS.SYNCED) {
      return null;
    }
    return userId;
  }

  static create(data, userId) {
    const supervisors = UserModel.findByRole(ROLES.SUPERVISOR);
    const firstSupervisor = supervisors.length > 0 ? supervisors[0].id : userId;

    const record = SideRecordModel.create({
      ...data,
      registrarId: userId,
      currentHandlerId: firstSupervisor
    });

    ProcessRecordModel.create({
      sideRecordId: record.id,
      action: 'create',
      fromStatus: null,
      toStatus: STATUS.PENDING_REVIEW,
      operatorId: userId,
      handlerId: firstSupervisor,
      remark: '创建旁站记录单，提交至专业监理工程师审核',
      version: 1
    });

    this._updateWarningGroup(record.id);
    return this.getDetail(record.id, userId, ROLES.REGISTRAR);
  }

  static async list(filters = {}, userId, userRole) {
    let records = SideRecordModel.findAll(filters);
    records = records.filter(r => canViewByRole(r, userRole, userId));
    return records.map(r => this._formatForList(r));
  }

  static getDetail(id, userId, userRole) {
    const record = SideRecordModel.findById(id);
    if (!record) return null;

    if (userRole && !canViewByRole(record, userRole, userId)) {
      return { __unauthorized: true, record: null };
    }

    const attachments = AttachmentModel.findBySideRecordId(id);
    const processRecords = ProcessRecordModel.findBySideRecordId(id);
    const auditNotes = AuditNoteModel.findBySideRecordId(id);
    const abnormalReasons = AbnormalReasonModel.findBySideRecordId(id);

    return {
      ...this._formatForList(record),
      sitePhoto: record.sitePhoto,
      inspectionRecord: record.inspectionRecord,
      signatures: record.signatures,
      attachments,
      processRecords,
      auditNotes,
      abnormalReasons,
      problemNoticeStatus: record.problemNoticeStatus,
      rectificationReviewStatus: record.rectificationReviewStatus
    };
  }

  static submit(id, data, userId, userRole) {
    const record = SideRecordModel.findById(id);
    if (!record) {
      return { success: false, message: '旁站记录单不存在' };
    }

    if (!canOperateByRole(record, userRole, userId)) {
      return { success: false, message: '当前角色或状态下您无权操作此单据' };
    }

    const versionCheck = validateVersion(record, data.version);
    if (!versionCheck.valid) {
      return { success: false, message: versionCheck.message };
    }

    const handlerCheck = validateHandler(record, userId);
    if (!handlerCheck.valid) {
      return { success: false, message: handlerCheck.message };
    }

    const targetStatus = STATUS.PENDING_REVIEW;
    const statusCheck = validateStatusTransition(record, targetStatus, userRole, userId);
    if (!statusCheck.valid && userRole !== ROLES.REGISTRAR) {
      return { success: false, message: statusCheck.message };
    }

    const updateData = this._extractUpdateData(data);
    const mergedEvidence = {
      sitePhoto: updateData.sitePhoto || record.sitePhoto,
      inspectionRecord: updateData.inspectionRecord || record.inspectionRecord,
      signatures: updateData.signatures || record.signatures
    };

    const missingEvidence = validateEvidence(mergedEvidence, 'submit');
    if (missingEvidence.length > 0) {
      const nextHandler = this._getNextHandler(STATUS.MATERIAL_MISSING, record, userId);
      const newVersion = record.version + 1;

      const tx = db.transaction(() => {
        AbnormalReasonModel.create({
          sideRecordId: id,
          reasonType: 'material_missing',
          reasonDetail: `提交时缺少必填证据：${missingEvidence.join(', ')}`,
          relatedField: missingEvidence.join(','),
          reportedBy: userId
        });

        SideRecordModel.update(id, {
          status: STATUS.MATERIAL_MISSING,
          abnormalReason: `缺少必填证据：${missingEvidence.join(', ')}`,
          abnormalType: 'material_missing',
          currentHandlerId: nextHandler,
          version: newVersion,
          ...updateData
        });

        ProcessRecordModel.create({
          sideRecordId: id,
          action: 'material_missing',
          fromStatus: record.status,
          toStatus: STATUS.MATERIAL_MISSING,
          operatorId: userId,
          handlerId: nextHandler,
          evidenceMissing: missingEvidence,
          abnormalReason: `缺少必填证据：${missingEvidence.join(', ')}`,
          abnormalType: 'material_missing',
          remark: data.remark,
          version: newVersion
        });
      });

      try {
        tx();
      } catch (err) {
        console.error('[Submit-Missing Tx Error', err);
        return { success: false, message: `事务执行失败：${err.message}` };
      }

      return { success: false, message: `缺少必填证据：${missingEvidence.join(', ')}，已转入缺料队列`, data: this.getDetail(id, userId, userRole) };
    }

    const nextHandler = this._getNextHandler(STATUS.PENDING_REVIEW, record, userId);
    const newVersion = record.version + 1;

    const tx = db.transaction(() => {
      SideRecordModel.update(id, {
        status: STATUS.PENDING_REVIEW,
        abnormalReason: null,
        abnormalType: null,
        currentHandlerId: nextHandler,
        version: newVersion,
        ...updateData
      });

      ProcessRecordModel.create({
        sideRecordId: id,
        action: 'submit',
        fromStatus: record.status,
        toStatus: STATUS.PENDING_REVIEW,
        operatorId: userId,
        handlerId: nextHandler,
        evidenceSubmitted: REQUIRED_EVIDENCE_FIELDS,
        remark: data.remark || '提交旁站记录单，已移交至专业监理工程师审核',
        version: newVersion
      });
    });

    try {
      tx();
    } catch (err) {
      console.error('[Submit Tx Error', err);
      return { success: false, message: `事务执行失败：${err.message}` };
    }

    this._updateWarningGroup(id);
    return { success: true, message: '提交成功，已移交至专业监理工程师审核', data: this.getDetail(id, userId, userRole) };
  }

  static review(id, data, userId, userRole) {
    const record = SideRecordModel.findById(id);
    if (!record) {
      return { success: false, message: '旁站记录单不存在' };
    }

    if (!canOperateByRole(record, userRole, userId)) {
      return { success: false, message: '当前角色或状态下您无权操作此单据' };
    }

    const versionCheck = validateVersion(record, data.version);
    if (!versionCheck.valid) {
      return { success: false, message: versionCheck.message };
    }

    const handlerCheck = validateHandler(record, userId);
    if (!handlerCheck.valid) {
      return { success: false, message: handlerCheck.message };
    }

    const action = data.action || 'pass';
    let targetStatus;
    let actionName;

    switch (action) {
      case 'pass':
        targetStatus = STATUS.REVIEW_PASSED;
        actionName = '审核通过';
        break;
      case 'return':
        targetStatus = STATUS.RETURNED;
        actionName = '退回补正';
        break;
      case 'missing':
        targetStatus = STATUS.MATERIAL_MISSING;
        actionName = '缺料退回';
        break;
      case 'overdue':
        targetStatus = STATUS.OVERDUE;
        actionName = '标记逾期';
        break;
      case 'conflict':
        targetStatus = STATUS.STATUS_CONFLICT;
        actionName = '状态冲突';
        break;
      default:
        return { success: false, message: `不支持的审核操作：${action}` };
    }

    const statusCheck = validateStatusTransition(record, targetStatus, userRole, userId);
    if (!statusCheck.valid) {
      return { success: false, message: statusCheck.message };
    }

    if ([STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(targetStatus)) {
      if (!data.abnormalReason || data.abnormalReason.trim() === '') {
        return { success: false, message: `操作「${actionName}」必须填写异常原因` };
      }
    }

    const updateData = this._extractUpdateData(data);
    const mergedEvidence = {
      sitePhoto: updateData.sitePhoto || record.sitePhoto,
      inspectionRecord: updateData.inspectionRecord || record.inspectionRecord,
      signatures: updateData.signatures || record.signatures
    };

    let missingEvidence = [];
    if (action === 'pass') {
      missingEvidence = validateEvidence(mergedEvidence, 'review');
      if (missingEvidence.length > 0) {
        return { success: false, message: `审核通过需确认证据完整，缺失：${missingEvidence.join(', ')}` };
      }
    }

    const nextHandler = this._getNextHandler(targetStatus, record, userId);
    const newVersion = record.version + 1;

    const tx = db.transaction(() => {
      if ([STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(targetStatus)) {
        AbnormalReasonModel.create({
          sideRecordId: id,
          reasonType: action,
          reasonDetail: data.abnormalReason,
          relatedField: data.relatedField || null,
          reportedBy: userId
        });
      }

      SideRecordModel.update(id, {
        status: targetStatus,
        reviewerId: userId,
        currentHandlerId: nextHandler,
        abnormalReason: data.abnormalReason || null,
        abnormalType: [STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(targetStatus) ? action : null,
        version: newVersion,
        problemNoticeStatus: data.problemNoticeStatus || record.problemNoticeStatus,
        rectificationReviewStatus: data.rectificationReviewStatus || record.rectificationReviewStatus,
        ...updateData
      });

      ProcessRecordModel.create({
        sideRecordId: id,
        action: action,
        fromStatus: record.status,
        toStatus: targetStatus,
        operatorId: userId,
        handlerId: nextHandler,
        evidenceSubmitted: action === 'pass' ? REQUIRED_EVIDENCE_FIELDS : null,
        evidenceMissing: action === 'missing' ? missingEvidence : null,
        abnormalReason: data.abnormalReason || null,
        abnormalType: [STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(targetStatus) ? action : null,
        remark: data.remark || `${actionName}，移交至${
          targetStatus === STATUS.RETURNED || targetStatus === STATUS.MATERIAL_MISSING 
            ? '登记人补正' 
            : targetStatus === STATUS.REVIEW_PASSED 
              ? '总监代表复核' 
              : '当前处理人'
        }`,
        version: newVersion
      });
    });

    try {
      tx();
    } catch (err) {
      console.error('[Review Tx Error]', err);
      return { success: false, message: `事务执行失败：${err.message}` };
    }

    this._updateWarningGroup(id);
    return { success: true, message: `${actionName}成功`, data: this.getDetail(id, userId, userRole) };
  }

  static archive(id, data, userId, userRole) {
    const record = SideRecordModel.findById(id);
    if (!record) {
      return { success: false, message: '旁站记录单不存在' };
    }

    if (!canOperateByRole(record, userRole, userId)) {
      return { success: false, message: '当前角色或状态下您无权操作此单据' };
    }

    const versionCheck = validateVersion(record, data.version);
    if (!versionCheck.valid) {
      return { success: false, message: versionCheck.message };
    }

    const handlerCheck = validateHandler(record, userId);
    if (!handlerCheck.valid) {
      return { success: false, message: handlerCheck.message };
    }

    const action = data.action || 'sync';
    let targetStatus;
    let actionName;

    switch (action) {
      case 'sync':
        targetStatus = STATUS.SYNCED;
        actionName = '同步归档';
        break;
      case 'return':
        targetStatus = STATUS.RETURNED;
        actionName = '退回补正';
        break;
      case 'missing':
        targetStatus = STATUS.MATERIAL_MISSING;
        actionName = '缺料退回';
        break;
      case 'overdue':
        targetStatus = STATUS.OVERDUE;
        actionName = '标记逾期';
        break;
      default:
        return { success: false, message: `不支持的复核操作：${action}` };
    }

    const statusCheck = validateStatusTransition(record, targetStatus, userRole, userId);
    if (!statusCheck.valid) {
      return { success: false, message: statusCheck.message };
    }

    if ([STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE].includes(targetStatus)) {
      if (!data.abnormalReason || data.abnormalReason.trim() === '') {
        return { success: false, message: `操作「${actionName}」必须填写异常原因` };
      }
    }

    const updateData = this._extractUpdateData(data);
    const mergedEvidence = {
      sitePhoto: record.sitePhoto,
      inspectionRecord: record.inspectionRecord,
      signatures: record.signatures
    };

    if (action === 'sync') {
      const missingEvidence = validateEvidence(mergedEvidence, 'archive');
      if (missingEvidence.length > 0) {
        return { success: false, message: `归档前证据不完整，缺失：${missingEvidence.join(', ')}` };
      }
    }

    const nextHandler = this._getNextHandler(targetStatus, record, userId);
    const newVersion = record.version + 1;

    const tx = db.transaction(() => {
      if ([STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE].includes(targetStatus) && data.abnormalReason) {
        AbnormalReasonModel.create({
          sideRecordId: id,
          reasonType: action,
          reasonDetail: data.abnormalReason,
          relatedField: data.relatedField || null,
          reportedBy: userId
        });
      }

      SideRecordModel.update(id, {
        status: targetStatus,
        finalArchiverId: userId,
        currentHandlerId: nextHandler,
        abnormalReason: data.abnormalReason || null,
        abnormalType: [STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE].includes(targetStatus) ? action : null,
        version: newVersion,
        problemNoticeStatus: data.problemNoticeStatus || record.problemNoticeStatus,
        rectificationReviewStatus: data.rectificationReviewStatus || record.rectificationReviewStatus,
        ...updateData
      });

      ProcessRecordModel.create({
        sideRecordId: id,
        action: action,
        fromStatus: record.status,
        toStatus: targetStatus,
        operatorId: userId,
        handlerId: nextHandler,
        evidenceSubmitted: action === 'sync' ? REQUIRED_EVIDENCE_FIELDS : null,
        abnormalReason: data.abnormalReason || null,
        abnormalType: [STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE].includes(targetStatus) ? action : null,
        remark: data.remark || `${actionName}，${
          targetStatus === STATUS.SYNCED 
            ? '已完成归档' 
            : targetStatus === STATUS.RETURNED || targetStatus === STATUS.MATERIAL_MISSING 
              ? '移交至登记人补正' 
              : '移交至当前处理人'
        }`,
        version: newVersion
      });
    });

    try {
      tx();
    } catch (err) {
      console.error('[Archive Tx Error]', err);
      return { success: false, message: `事务执行失败：${err.message}` };
    }

    this._updateWarningGroup(id);
    return { success: true, message: `${actionName}成功`, data: this.getDetail(id, userId, userRole) };
  }

  static async batchProcess(ids, action, data, userId, userRole) {
    const results = [];
    for (const id of ids) {
      try {
        const record = SideRecordModel.findById(id);
        if (!record) {
          results.push({
            id,
            recordNo: id,
            success: false,
            message: '旁站记录单不存在'
          });
          continue;
        }

        const recordNo = record.recordNo;
        const currentVersion = record.version;

        if (data.version === undefined || data.version === null) {
          data.version = currentVersion;
        }

        let result;

        if (userRole === ROLES.REGISTRAR) {
          if (action !== 'submit') {
            results.push({
              id, recordNo,
              success: false,
              message: '越权：登记员只能执行批量提交操作'
            });
            continue;
          }
          result = this.submit(id, { ...data, version: currentVersion }, userId, userRole);

        } else if (userRole === ROLES.SUPERVISOR) {
          const allowedActions = ['pass', 'return', 'missing', 'overdue', 'conflict'];
          if (!allowedActions.includes(action)) {
            results.push({
              id, recordNo,
              success: false,
              message: `越权：审核主管只能执行 ${allowedActions.join('/')} 操作`
            });
            continue;
          }
          result = this.review(id, { ...data, action, version: currentVersion }, userId, userRole);

        } else if (userRole === ROLES.REVIEWER) {
          const allowedActions = ['sync', 'return', 'missing', 'overdue'];
          if (!allowedActions.includes(action)) {
            results.push({
              id, recordNo,
              success: false,
              message: `越权：复核负责人只能执行 ${allowedActions.join('/')} 操作`
            });
            continue;
          }
          result = this.archive(id, { ...data, action, version: currentVersion }, userId, userRole);

        } else {
          result = { success: false, message: `未知角色：${userRole}，无权执行批量操作` };
        }

        results.push({
          id,
          recordNo,
          success: result.success,
          message: result.message,
          newStatus: result.data?.status,
          newHandler: result.data?.currentHandlerName
        });
      } catch (err) {
        console.error('[Batch Error]', err);
        results.push({
          id,
          recordNo: SideRecordModel.findById(id)?.recordNo || id,
          success: false,
          message: `处理异常：${err.message}`
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      message: `批量处理完成：成功 ${successCount} 条，失败 ${results.length - successCount} 条`,
      data: { total: results.length, successCount, failCount: results.length - successCount, details: results }
    };
  }

  static addAuditNote(id, content, userId) {
    const record = SideRecordModel.findById(id);
    if (!record) {
      return { success: false, message: '旁站记录单不存在' };
    }

    const note = AuditNoteModel.create({
      sideRecordId: id,
      content,
      createdBy: userId
    });

    return { success: true, data: note };
  }

  static getStatistics(userId, userRole) {
    const allRecords = SideRecordModel.findAll();
    const visibleRecords = allRecords.filter(r => canViewByRole(r, userRole, userId));

    const grouped = {
      total: visibleRecords.length,
      byStatus: {},
      byWarningGroup: { normal: 0, approaching: 0, overdue: 0 },
      byModule: { registration: 0, verification: 0, archiving: 0, ledger: 0 }
    };

    for (const s of Object.values(STATUS)) {
      grouped.byStatus[s] = 0;
    }

    for (const r of visibleRecords) {
      grouped.byStatus[r.status] = (grouped.byStatus[r.status] || 0) + 1;
      if (r.warningGroup) {
        grouped.byWarningGroup[r.warningGroup] = (grouped.byWarningGroup[r.warningGroup] || 0) + 1;
      }

      if ([STATUS.PENDING_REVIEW, STATUS.RETURNED, STATUS.MATERIAL_MISSING].includes(r.status)) {
        grouped.byModule.registration++;
      }
      if ([STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(r.status)) {
        grouped.byModule.verification++;
      }
      if ([STATUS.REVIEW_PASSED, STATUS.OVERDUE, STATUS.SYNCED].includes(r.status)) {
        grouped.byModule.archiving++;
      }
      grouped.byModule.ledger++;
    }

    return grouped;
  }

  static getWarningList(userId, userRole) {
    const allRecords = SideRecordModel.findAll();
    const visible = allRecords.filter(r => canViewByRole(r, userRole, userId));
    return visible
      .filter(r => r.warningGroup && r.warningGroup !== 'normal')
      .map(r => this._formatForList(r));
  }

  static _updateWarningGroup(id) {
    const record = SideRecordModel.findById(id);
    if (!record || !record.deadline) return;

    const now = dayjs();
    const deadline = dayjs(record.deadline);
    let group = WARNING_GROUPS.NORMAL;

    if (deadline.isBefore(now, 'day')) {
      group = WARNING_GROUPS.OVERDUE;
    } else if (deadline.diff(now, 'day') <= WARNING_DAYS.APPROACHING) {
      group = WARNING_GROUPS.APPROACHING;
    }

    SideRecordModel.update(id, {
      warningGroup: group,
      lastReminderTime: group !== WARNING_GROUPS.NORMAL ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null
    });
  }

  static _extractUpdateData(data) {
    const fields = [
      'projectName', 'projectCode', 'location', 'workContent',
      'sideRecordClue', 'weather', 'recordDate', 'deadline',
      'sitePhoto', 'inspectionRecord', 'signatures', 'attachments'
    ];
    const result = {};
    for (const f of fields) {
      if (data[f] !== undefined) result[f] = data[f];
    }
    return result;
  }

  static _formatForList(record) {
    return {
      id: record.id,
      recordNo: record.recordNo,
      projectName: record.projectName,
      projectCode: record.projectCode,
      location: record.location,
      workContent: record.workContent,
      sideRecordClue: record.sideRecordClue,
      weather: record.weather,
      recordDate: record.recordDate,
      deadline: record.deadline,
      status: record.status,
      statusName: STATUS_NAMES[record.status] || record.status,
      version: record.version,
      warningGroup: record.warningGroup,
      registrarId: record.registrarId,
      registrarName: record.registrarName,
      currentHandlerId: record.currentHandlerId,
      currentHandlerName: record.currentHandlerName,
      reviewerId: record.reviewerId,
      reviewerName: record.reviewerName,
      finalArchiverId: record.finalArchiverId,
      finalArchiverName: record.finalArchiverName,
      abnormalReason: record.abnormalReason,
      abnormalType: record.abnormalType,
      problemNoticeStatus: record.problemNoticeStatus,
      rectificationReviewStatus: record.rectificationReviewStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastReminderTime: record.lastReminderTime
    };
  }
}

module.exports = SideRecordService;
