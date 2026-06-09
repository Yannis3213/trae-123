export type UserRole = 'doctor' | 'consultant' | 'dean';

export type TreatmentPlanStatus =
  | 'pending_confirm'
  | 'confirmed'
  | 'exception'
  | 'pending_review'
  | 'reviewed'
  | 'archived';

export type AttachmentType = 'patient' | 'plan' | 'reminder';

export type ExceptionType = 'material' | 'permission' | 'timeline' | 'status';

export type DeadlineWarning = 'normal' | 'approaching' | 'overdue';

export const STATUS_FLOW: Record<TreatmentPlanStatus, TreatmentPlanStatus[]> = {
  pending_confirm: ['confirmed'],
  confirmed: ['exception', 'pending_review'],
  exception: ['pending_review'],
  pending_review: ['reviewed'],
  reviewed: ['archived'],
  archived: [],
};

export const ROLE_PERMISSIONS: Record<UserRole, TreatmentPlanStatus[]> = {
  consultant: ['pending_confirm'],
  doctor: ['confirmed', 'exception'],
  dean: ['pending_review', 'reviewed'],
};

export const STATUS_HANDLER_ROLE: Record<TreatmentPlanStatus, UserRole> = {
  pending_confirm: 'consultant',
  confirmed: 'doctor',
  exception: 'doctor',
  pending_review: 'dean',
  reviewed: 'dean',
  archived: 'dean',
};
