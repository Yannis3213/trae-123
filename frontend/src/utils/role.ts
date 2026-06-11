import type { UserRole } from '../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  reimbursement_clerk: '报销专员',
  expense_accountant: '费用会计',
  finance_manager: '财务经理',
};

export const DEMO_ACCOUNTS: Array<{
  username: string;
  password: string;
  name: string;
  role: UserRole;
}> = [
  {
    username: 'clerk01',
    password: '123456',
    name: '张报销',
    role: 'reimbursement_clerk',
  },
  {
    username: 'accountant01',
    password: '123456',
    name: '李会计',
    role: 'expense_accountant',
  },
  {
    username: 'manager01',
    password: '123456',
    name: '王经理',
    role: 'finance_manager',
  },
];

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] || role;
}
