import { writable } from 'svelte/store';

export const userStore = writable(null);
export const roleOptions = writable([]);

export const statusColors = {
  draft: '#9ca3af',
  returned: '#ef4444',
  resubmitted: '#f59e0b',
  bom_pending: '#3b82f6',
  bom_confirmed: '#60a5fa',
  substitute_pending: '#8b5cf6',
  substitute_checked: '#a78bfa',
  pilot_pending: '#0ea5e9',
  pilot_passed: '#38bdf8',
  audit_pending: '#f97316',
  audit_passed: '#fb923c',
  pm_review_pending: '#14b8a6',
  pm_review_passed: '#2dd4bf',
  factory_review_pending: '#10b981',
  archived: '#22c55e',
};

export const warnColors = {
  normal: '#22c55e',
  near_deadline: '#f59e0b',
  overdue: '#ef4444',
};
