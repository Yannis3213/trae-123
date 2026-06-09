const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

const JWT_SECRET = 'kindergarten-morning-check-secret-key-2024';

const ROLES = {
  REGISTRAR: 'registrar',
  SUPERVISOR: 'supervisor',
  PRINCIPAL: 'principal'
};

const ROLE_NAMES = {
  registrar: '晨检登记员',
  supervisor: '晨检审核主管',
  principal: '幼儿园复核负责人'
};

const STATUS = {
  PENDING_REGISTRATION: 'pending_registration',
  PENDING_REVIEW: 'pending_review',
  ACCEPTED: 'accepted',
  PENDING_REGISTRAR_CORRECTION: 'pending_registrar_correction',
  PENDING_SUPERVISOR_CORRECTION: 'pending_supervisor_correction',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

const STATUS_NAMES = {
  pending_registration: '待登记',
  pending_review: '待接单',
  accepted: '已接单',
  pending_registrar_correction: '退回登记员补正',
  pending_supervisor_correction: '退回主管补正',
  verified: '验收通过',
  rejected: '已退回'
};

const ATTACHMENT_TYPES = {
  REGISTRATION: 'registration',
  CHILD_PROFILE: 'child_profile',
  ABNORMAL_NOTICE: 'abnormal_notice'
};

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `当前角色(${ROLE_NAMES[req.user.role] || req.user.role})无权限执行此操作` });
    }
    next();
  };
}

function canHandleRecord(user, record) {
  if (!record) return false;
  if (record.status === STATUS.VERIFIED) return false;

  if (record.status === STATUS.PENDING_REGISTRATION || record.status === STATUS.PENDING_REGISTRAR_CORRECTION) {
    return user.role === ROLES.REGISTRAR && record.current_handler === user.username;
  }

  if (record.status === STATUS.PENDING_REVIEW || record.status === STATUS.PENDING_SUPERVISOR_CORRECTION) {
    return user.role === ROLES.SUPERVISOR && record.current_handler === user.username;
  }

  if (record.status === STATUS.ACCEPTED) {
    return user.role === ROLES.PRINCIPAL && record.current_handler === user.username;
  }

  return false;
}

function validateEvidence(recordId, action, healthStatus, attachments) {
  const errors = [];
  const hasRegistration = attachments.some(a => a.type === ATTACHMENT_TYPES.REGISTRATION);
  const hasChildProfile = attachments.some(a => a.type === ATTACHMENT_TYPES.CHILD_PROFILE);

  if (action === 'submit' || action === 'correction_submit') {
    if (!hasRegistration) errors.push('缺少晨检登记表证据');
    if (!hasChildProfile) errors.push('缺少幼儿档案证据');
    if (healthStatus === 'abnormal') {
      const hasAbnormalNotice = attachments.some(a => a.type === ATTACHMENT_TYPES.ABNORMAL_NOTICE);
      if (!hasAbnormalNotice) errors.push('异常情况缺少异常通知书证据');
    }
  }

  return errors;
}

function getDeadlineStatus(deadline) {
  if (!deadline) return 'normal';
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 1) return 'warning';
  return 'normal';
}

module.exports = {
  JWT_SECRET,
  ROLES,
  ROLE_NAMES,
  STATUS,
  STATUS_NAMES,
  ATTACHMENT_TYPES,
  generateToken,
  authMiddleware,
  roleMiddleware,
  canHandleRecord,
  validateEvidence,
  getDeadlineStatus
};
