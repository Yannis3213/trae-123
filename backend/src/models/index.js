const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { STATUS, ROLES } = require('../config');

class UserModel {
  static create(user) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO users (id, username, password, name, role, department, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, user.username, user.password, user.name, user.role, user.department || null, user.phone || null);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  static findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  static findAll() {
    return db.prepare('SELECT id, username, name, role, department, phone, created_at FROM users').all();
  }

  static findByRole(role) {
    return db.prepare('SELECT id, username, name, role, department FROM users WHERE role = ?').all(role);
  }
}

class SideRecordModel {
  static generateRecordNo() {
    const prefix = 'PZJL';
    const date = dayjs().format('YYYYMMDD');
    const count = db.prepare("SELECT COUNT(*) as cnt FROM side_records WHERE record_no LIKE ?").get(`${prefix}${date}%`).cnt;
    return `${prefix}${date}${String(count + 1).padStart(4, '0')}`;
  }

  static create(data) {
    const id = uuidv4();
    const recordNo = this.generateRecordNo();
    const stmt = db.prepare(`
      INSERT INTO side_records (
        id, record_no, project_name, project_code, location, work_content,
        side_record_clue, weather, record_date, deadline,
        site_photo, inspection_record, signatures, attachments,
        status, version, registrar_id, current_handler_id,
        problem_notice_status, rectification_review_status, warning_group
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, recordNo, data.projectName, data.projectCode || null, data.location || null,
      data.workContent, data.sideRecordClue || null, data.weather || null,
      data.recordDate, data.deadline || null,
      data.sitePhoto || null, data.inspectionRecord || null, data.signatures || null,
      data.attachments ? JSON.stringify(data.attachments) : null,
      STATUS.PENDING_REVIEW, 1, data.registrarId, data.currentHandlerId || null,
      data.problemNoticeStatus || null, data.rectificationReviewStatus || null,
      'normal'
    );
    return this.findById(id);
  }

  static findById(id) {
    const row = db.prepare(`
      SELECT sr.*,
        u1.name as registrar_name,
        u2.name as current_handler_name,
        u3.name as reviewer_name,
        u4.name as final_archiver_name
      FROM side_records sr
      LEFT JOIN users u1 ON sr.registrar_id = u1.id
      LEFT JOIN users u2 ON sr.current_handler_id = u2.id
      LEFT JOIN users u3 ON sr.reviewer_id = u3.id
      LEFT JOIN users u4 ON sr.final_archiver_id = u4.id
      WHERE sr.id = ?
    `).get(id);
    return row ? this._normalize(row) : null;
  }

  static findByRecordNo(recordNo) {
    const row = db.prepare(`
      SELECT sr.*,
        u1.name as registrar_name,
        u2.name as current_handler_name
      FROM side_records sr
      LEFT JOIN users u1 ON sr.registrar_id = u1.id
      LEFT JOIN users u2 ON sr.current_handler_id = u2.id
      WHERE sr.record_no = ?
    `).get(recordNo);
    return row ? this._normalize(row) : null;
  }

  static update(id, data) {
    const fields = [];
    const values = [];
    const fieldMap = {
      projectName: 'project_name',
      projectCode: 'project_code',
      location: 'location',
      workContent: 'work_content',
      sideRecordClue: 'side_record_clue',
      weather: 'weather',
      recordDate: 'record_date',
      deadline: 'deadline',
      sitePhoto: 'site_photo',
      inspectionRecord: 'inspection_record',
      signatures: 'signatures',
      attachments: 'attachments',
      status: 'status',
      version: 'version',
      currentHandlerId: 'current_handler_id',
      reviewerId: 'reviewer_id',
      finalArchiverId: 'final_archiver_id',
      problemNoticeStatus: 'problem_notice_status',
      rectificationReviewStatus: 'rectification_review_status',
      abnormalReason: 'abnormal_reason',
      abnormalType: 'abnormal_type',
      warningGroup: 'warning_group',
      lastReminderTime: 'last_reminder_time'
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(key === 'attachments' && typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push("updated_at = datetime('now', 'localtime')");
    values.push(id);

    db.prepare(`UPDATE side_records SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static incrementVersion(id) {
    const current = db.prepare('SELECT version FROM side_records WHERE id = ?').get(id);
    if (!current) return null;
    const newVersion = current.version + 1;
    db.prepare('UPDATE side_records SET version = ?, updated_at = datetime(?, ?) WHERE id = ?')
      .run(newVersion, 'now', 'localtime', id);
    return newVersion;
  }

  static findAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push('sr.status = ?');
      params.push(filters.status);
    }
    if (filters.statuses && Array.isArray(filters.statuses)) {
      conditions.push(`sr.status IN (${filters.statuses.map(() => '?').join(',')})`);
      params.push(...filters.statuses);
    }
    if (filters.sideRecordClue) {
      conditions.push('sr.side_record_clue LIKE ?');
      params.push(`%${filters.sideRecordClue}%`);
    }
    if (filters.projectName) {
      conditions.push('sr.project_name LIKE ?');
      params.push(`%${filters.projectName}%`);
    }
    if (filters.recordNo) {
      conditions.push('sr.record_no LIKE ?');
      params.push(`%${filters.recordNo}%`);
    }
    if (filters.currentHandlerId) {
      conditions.push('sr.current_handler_id = ?');
      params.push(filters.currentHandlerId);
    }
    if (filters.registrarId) {
      conditions.push('sr.registrar_id = ?');
      params.push(filters.registrarId);
    }
    if (filters.warningGroup) {
      conditions.push('sr.warning_group = ?');
      params.push(filters.warningGroup);
    }
    if (filters.warningGroups && Array.isArray(filters.warningGroups)) {
      conditions.push(`sr.warning_group IN (${filters.warningGroups.map(() => '?').join(',')})`);
      params.push(...filters.warningGroups);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT sr.*,
        u1.name as registrar_name,
        u2.name as current_handler_name
      FROM side_records sr
      LEFT JOIN users u1 ON sr.registrar_id = u1.id
      LEFT JOIN users u2 ON sr.current_handler_id = u2.id
      ${whereSql}
      ORDER BY sr.created_at DESC
    `).all(...params);

    return rows.map(r => this._normalize(r));
  }

  static _normalize(row) {
    const result = { ...row };
    if (result.attachments && typeof result.attachments === 'string') {
      try { result.attachments = JSON.parse(result.attachments); } catch (e) { result.attachments = []; }
    }
    result.projectName = row.project_name;
    result.projectCode = row.project_code;
    result.workContent = row.work_content;
    result.sideRecordClue = row.side_record_clue;
    result.recordNo = row.record_no;
    result.recordDate = row.record_date;
    result.sitePhoto = row.site_photo;
    result.inspectionRecord = row.inspection_record;
    result.problemNoticeStatus = row.problem_notice_status;
    result.rectificationReviewStatus = row.rectification_review_status;
    result.abnormalReason = row.abnormal_reason;
    result.abnormalType = row.abnormal_type;
    result.warningGroup = row.warning_group;
    result.registrarId = row.registrar_id;
    result.registrarName = row.registrar_name;
    result.currentHandlerId = row.current_handler_id;
    result.currentHandlerName = row.current_handler_name;
    result.reviewerId = row.reviewer_id;
    result.reviewerName = row.reviewer_name;
    result.finalArchiverId = row.final_archiver_id;
    result.finalArchiverName = row.final_archiver_name;
    result.createdAt = row.created_at;
    result.updatedAt = row.updated_at;
    result.lastReminderTime = row.last_reminder_time;
    return result;
  }
}

class AttachmentModel {
  static create(data) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO attachments (id, side_record_id, file_name, file_type, file_size, file_path, file_url, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.sideRecordId, data.fileName, data.fileType || null, data.fileSize || null,
           data.filePath || null, data.fileUrl || null, data.uploadedBy);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  }

  static findBySideRecordId(sideRecordId) {
    return db.prepare(`
      SELECT a.*, u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.side_record_id = ?
      ORDER BY a.created_at DESC
    `).all(sideRecordId);
  }
}

class ProcessRecordModel {
  static create(data) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO process_records (
        id, side_record_id, action, from_status, to_status,
        operator_id, handler_id, evidence_submitted, evidence_missing,
        abnormal_reason, abnormal_type, remark, version, status_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.sideRecordId, data.action, data.fromStatus || null, data.toStatus || null,
      data.operatorId, data.handlerId || null,
      data.evidenceSubmitted ? JSON.stringify(data.evidenceSubmitted) : null,
      data.evidenceMissing ? JSON.stringify(data.evidenceMissing) : null,
      data.abnormalReason || null, data.abnormalType || null,
      data.remark || null, data.version || null,
      data.statusSnapshot ? JSON.stringify(data.statusSnapshot) : null
    );
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM process_records WHERE id = ?').get(id);
  }

  static findBySideRecordId(sideRecordId) {
    const rows = db.prepare(`
      SELECT pr.*, u.name as operator_name, u2.name as handler_name
      FROM process_records pr
      LEFT JOIN users u ON pr.operator_id = u.id
      LEFT JOIN users u2 ON pr.handler_id = u2.id
      WHERE pr.side_record_id = ?
      ORDER BY pr.processed_at DESC
    `).all(sideRecordId);
    return rows.map(r => {
      const result = { ...r };
      result.operatorName = r.operator_name;
      result.handlerName = r.handler_name;
      result.fromStatus = r.from_status;
      result.toStatus = r.to_status;
      result.sideRecordId = r.side_record_id;
      result.evidenceSubmitted = r.evidence_submitted ? JSON.parse(r.evidence_submitted) : null;
      result.evidenceMissing = r.evidence_missing ? JSON.parse(r.evidence_missing) : null;
      result.abnormalReason = r.abnormal_reason;
      result.abnormalType = r.abnormal_type;
      result.processedAt = r.processed_at;
      return result;
    });
  }
}

class AuditNoteModel {
  static create(data) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO audit_notes (id, side_record_id, content, created_by)
      VALUES (?, ?, ?, ?)
    `).run(id, data.sideRecordId, data.content, data.createdBy);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM audit_notes WHERE id = ?').get(id);
  }

  static findBySideRecordId(sideRecordId) {
    const rows = db.prepare(`
      SELECT an.*, u.name as created_by_name
      FROM audit_notes an
      LEFT JOIN users u ON an.created_by = u.id
      WHERE an.side_record_id = ?
      ORDER BY an.created_at DESC
    `).all(sideRecordId);
    return rows.map(r => ({
      ...r,
      sideRecordId: r.side_record_id,
      createdBy: r.created_by,
      createdByName: r.created_by_name,
      createdAt: r.created_at
    }));
  }
}

class AbnormalReasonModel {
  static create(data) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO abnormal_reasons (id, side_record_id, reason_type, reason_detail, related_field, reported_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.sideRecordId, data.reasonType, data.reasonDetail, data.relatedField || null, data.reportedBy);
    return this.findById(id);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM abnormal_reasons WHERE id = ?').get(id);
  }

  static findBySideRecordId(sideRecordId) {
    const rows = db.prepare(`
      SELECT ar.*, u.name as reported_by_name, u2.name as resolved_by_name
      FROM abnormal_reasons ar
      LEFT JOIN users u ON ar.reported_by = u.id
      LEFT JOIN users u2 ON ar.resolved_by = u2.id
      WHERE ar.side_record_id = ?
      ORDER BY ar.created_at DESC
    `).all(sideRecordId);
    return rows.map(r => ({
      ...r,
      sideRecordId: r.side_record_id,
      reasonType: r.reason_type,
      reasonDetail: r.reason_detail,
      relatedField: r.related_field,
      reportedBy: r.reported_by,
      reportedByName: r.reported_by_name,
      resolvedBy: r.resolved_by,
      resolvedByName: r.resolved_by_name,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at
    }));
  }

  static resolve(id, resolvedBy) {
    db.prepare(`
      UPDATE abnormal_reasons
      SET resolved = 1, resolved_by = ?, resolved_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(resolvedBy, id);
    return this.findById(id);
  }
}

module.exports = {
  UserModel,
  SideRecordModel,
  AttachmentModel,
  ProcessRecordModel,
  AuditNoteModel,
  AbnormalReasonModel
};
