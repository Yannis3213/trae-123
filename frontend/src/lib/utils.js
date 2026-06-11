import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-';
  return dayjs(date).format(format);
};

export const formatRelativeTime = (date) => {
  if (!date) return '-';
  return dayjs(date).fromNow();
};

export const getDeadlineStatus = (deadline) => {
  if (!deadline) return { type: 'normal', label: '无期限', color: 'default' };

  const now = dayjs();
  const diff = dayjs(deadline).diff(now, 'day');

  if (diff < 0) {
    return { type: 'overdue', label: `逾期${Math.abs(diff)}天`, color: 'red' };
  } else if (diff <= 1) {
    const hours = dayjs(deadline).diff(now, 'hour');
    return { type: 'near', label: `剩余${hours}小时`, color: 'orange' };
  } else {
    return { type: 'normal', label: `剩余${diff}天`, color: 'green' };
  }
};

export const getStatusTag = (status) => {
  const statusMap = {
    pending_sign: { color: 'blue', label: '待签收' },
    abnormal_return: { color: 'red', label: '异常回传' },
    sign_completed: { color: 'cyan', label: '签收完成' },
    pending_audit: { color: 'gold', label: '待审核' },
    audit_passed: { color: 'green', label: '审核通过' },
    audit_rejected: { color: 'red', label: '审核拒绝' },
    pending_registration: { color: 'blue', label: '待登记' },
    registration_completed: { color: 'cyan', label: '登记完成' },
    pending_final_review: { color: 'purple', label: '待复核' },
    final_review_passed: { color: 'green', label: '复核通过' },
    final_review_rejected: { color: 'red', label: '复核拒绝' },
    supplement_required: { color: 'orange', label: '需补正' },
    archived: { color: 'default', label: '已归档' },
  };
  return statusMap[status] || { color: 'default', label: status };
};

export const getRoleLabel = (role) => {
  const roleMap = {
    merchant_registrar: '商家入驻登记员',
    audit_supervisor: '商家入驻审核主管',
    platform_leader: 'B2B批发平台复核负责人',
  };
  return roleMap[role] || role;
};

export const getNodeLabel = (node) => {
  const nodeMap = {
    entry_registration: '商家入驻',
    qualification_audit: '资质审核',
    entry_form_registration: '商家入驻单登记',
    final_review: '平台复核',
    archived: '已归档',
  };
  return nodeMap[node] || node;
};

export const getExceptionTypeLabel = (type) => {
  const typeMap = {
    material_missing: '材料问题',
    permission_denied: '权限问题',
    timeout: '时限问题',
    status_conflict: '状态问题',
    version_conflict: '版本冲突',
    duplicate_submit: '重复提交',
    evidence_missing: '证据缺失',
  };
  return typeMap[type] || type;
};

export const getEvidenceTypeLabel = (type) => {
  const typeMap = {
    business_license: '营业执照',
    tax_certificate: '税务登记证',
    id_card: '法人身份证',
    bank_certificate: '开户许可证',
    other: '其他材料',
    supplement_document: '补正材料',
  };
  return typeMap[type] || type;
};

export const getAvailableOperations = (form, userRole) => {
  const operations = [];
  const { current_node, status, current_handler } = form;

  if (status === 'archived') return operations;

  if (current_node === 'entry_registration' && userRole === 'merchant_registrar') {
    if (status === 'pending_sign' || status === 'abnormal_return' || status === 'supplement_required') {
      operations.push({ key: 'sign', label: '签收', type: 'primary' });
    }
    if (status === 'sign_completed') {
      operations.push({ key: 'submit_audit', label: '提交审核', type: 'primary' });
      operations.push({ key: 'supplement', label: '补正材料', type: 'default' });
    }
    if (status === 'supplement_required' || status === 'abnormal_return') {
      operations.push({ key: 'supplement', label: '补正材料', type: 'warning' });
    }
  }

  if (current_node === 'qualification_audit' && userRole === 'audit_supervisor') {
    if (status === 'pending_audit') {
      operations.push({ key: 'audit_pass', label: '审核通过', type: 'primary' });
      operations.push({ key: 'return_supplement', label: '退回补正', type: 'warning' });
      operations.push({ key: 'audit_reject', label: '审核拒绝', type: 'danger' });
    }
  }

  if (current_node === 'entry_form_registration' && userRole === 'merchant_registrar') {
    if (status === 'pending_registration') {
      operations.push({ key: 'register', label: '完成登记', type: 'primary' });
      operations.push({ key: 'supplement', label: '补正材料', type: 'default' });
    }
    if (status === 'registration_completed') {
      operations.push({ key: 'submit_final_review', label: '提交复核', type: 'primary' });
    }
    if (status === 'supplement_required' || status === 'abnormal_return') {
      operations.push({ key: 'supplement', label: '补正材料', type: 'warning' });
    }
  }

  if (current_node === 'final_review' && userRole === 'platform_leader') {
    if (status === 'pending_final_review') {
      operations.push({ key: 'final_review_pass', label: '复核通过', type: 'primary' });
      operations.push({ key: 'return_supplement', label: '退回补正', type: 'warning' });
      operations.push({ key: 'final_review_reject', label: '复核拒绝', type: 'danger' });
    }
  }

  return operations;
};

export const getBusinessTypes = () => [
  '日用百货', '服装鞋帽', '电子产品', '食品饮料',
  '家居建材', '五金交电', '办公用品', '其他'
];
