export const ROLE_LABELS: Record<string, string> = {
  lease_clerk: '租务专员',
  maintenance_coordinator: '维修协调员',
  store_manager: '门店经理',
};

export const STATUS_LABELS: Record<string, string> = {
  pending_verification: '待核验',
  verification_failed: '核验失败',
  verification_complete: '核验完成',
};

export const STATUS_COLORS: Record<string, string> = {
  pending_verification: 'blue',
  verification_failed: 'red',
  verification_complete: 'green',
};

export const SUB_MODULE_LABELS: Record<string, string> = {
  pending: '待处理',
  complete: '已完成',
  failed: '异常',
};

export const EXPIRY_LABELS: Record<string, string> = {
  normal: '正常',
  expiring_soon: '临期',
  overdue: '逾期',
};

export const EXPIRY_COLORS: Record<string, string> = {
  normal: 'green',
  expiring_soon: 'orange',
  overdue: 'red',
};

export const ACTION_LABELS: Record<string, string> = {
  correct: '补正',
  verify_pass: '核验通过',
  verify_fail: '核验失败',
  confirm: '确认',
};

export const ERROR_MESSAGES: Record<number, string> = {
  40101: '请先选择角色',
  40301: '当前角色无权执行此操作',
  40302: '当前申请应由其他角色处理',
  40901: '版本冲突，数据已被其他人员修改，请刷新重试',
  40902: '当前状态不允许执行此操作',
  40903: '缺少必要附件，无法完成核验',
  40904: '该申请已被处理，请勿重复提交',
};

export const DEFAULT_USER = {
  role: 'lease_clerk' as const,
  userId: 'user_001',
  userName: '张租赁',
};

export function getUserInfo() {
  const stored = localStorage.getItem('userInfo');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_USER;
    }
  }
  return DEFAULT_USER;
}

export function setUserInfo(info: { role: string; userId: string; userName: string }) {
  localStorage.setItem('userInfo', JSON.stringify(info));
}
