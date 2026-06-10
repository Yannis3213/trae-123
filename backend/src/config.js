const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '3000', 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);
const CORS_WHITELIST = [
  `http://localhost:${FRONTEND_PORT}`,
  `http://127.0.0.1:${FRONTEND_PORT}`,
];

const EVIDENCE_RULES = {
  registrar: ['id_card', 'registration_form'],
  supervisor: ['deposit_slip', 'review_note'],
  reviewer: [],
};

const STATUS_LABEL = {
  pending: '待分派',
  transferred: '已转办',
  reviewed: '已回访',
  archived: '已归档',
};

const STATUS_PAGE_TABS = ['pending', 'transferred', 'reviewed'];

const ACTION_MAP = {
  create: '登记',
  transfer: '转办',
  review: '复核',
  archive: '归档',
  return: '退回补正',
  correct: '补正提交',
  overdue_push: '逾期批量推进',
};

const ROLE_LABEL = {
  registrar: '住客登记员',
  supervisor: '住客审核主管',
  reviewer: '酒店集团复核负责人',
};

const EVIDENCE_LABEL = {
  id_card: '身份证凭证',
  registration_form: '入住登记单',
  deposit_slip: '押金收据',
  review_note: '核验/回访记录',
  other: '其他材料',
};

export {
  FRONTEND_PORT,
  BACKEND_PORT,
  CORS_WHITELIST,
  EVIDENCE_RULES,
  STATUS_LABEL,
  STATUS_PAGE_TABS,
  ACTION_MAP,
  ROLE_LABEL,
  EVIDENCE_LABEL,
};
