export const API_BASE_URL = (import.meta as any).env?.PUBLIC_API_BASE_URL || 'http://localhost:8001/api';

export type Role = 'registrar' | 'auditor' | 'reviewer';
export type ConsultationStatus = 'pending' | 'abnormal' | 'rechecked' | 'archived';
export type ProcessStage = 'registration' | 'verification' | 'review';
export type UrgencyLevel = 'normal' | 'warning' | 'overdue';

export interface User {
  id: string;
  username: string;
  real_name: string;
  role: Role;
  department: string;
  created_at: string;
}

export interface Consultation {
  id: string;
  patient_name: string;
  patient_id: string;
  age: number;
  gender: string;
  department: string;
  attending_physician: string;
  consultation_type: string;
  consultation_reason: string;
  consultation_dept: string;
  requested_doctor: string;
  appointment_time?: string;
  deadline?: string;
  status: ConsultationStatus;
  current_stage: ProcessStage;
  current_handler: string;
  urgency: UrgencyLevel;
  evidence_list: string;
  version: number;
  is_archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
  result?: string;
  schedule_verified: boolean;
  feedback_verified: boolean;
}

export interface ProcessRecord {
  id: string;
  consultation_id: string;
  stage: ProcessStage;
  action: string;
  from_status: ConsultationStatus;
  to_status: ConsultationStatus;
  handler_id: string;
  handler_name: string;
  handler_role: Role;
  remark: string;
  evidence_used: string;
  version: number;
  created_at: string;
}

export interface AbnormalRecord {
  id: string;
  consultation_id: string;
  abnormal_type: string;
  reason: string;
  reported_by: string;
  is_resolved: boolean;
  resolution?: string;
  resolved_at?: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  consultation_id: string;
  file_name: string;
  file_type: string;
  evidence_type: string;
  uploaded_by: string;
  created_at: string;
}

export interface AuditNote {
  id: string;
  consultation_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface ProcessResult {
  success: boolean;
  message: string;
  id?: string;
}

export interface BatchResult {
  total: number;
  success_count: number;
  fail_count: number;
  details: ProcessResult[];
}
