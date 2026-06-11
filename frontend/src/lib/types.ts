export type Status = 'pending_correction' | 'under_review' | 'completed';
export type Step = 'home_inspection' | 'hazard_rectification' | 'recheck_closure';
export type ExpiryStatus = 'normal' | 'near_expiry' | 'overdue';

export interface HomeInspection {
  inspector: string;
  inspection_date: string;
  inspection_result: string;
  anomalies: string;
  evidence_photos?: string[];
  submitted?: boolean;
}

export interface HazardRectification {
  hazard_level: string;
  rectification_measures: string;
  rectification_date: string;
  approved: boolean | null;
  completed?: boolean;
  evidence_photos?: string[];
}

export interface RecheckClosure {
  recheck_result: string;
  recheck_date: string;
  confirmed: boolean | null;
  closed?: boolean;
  evidence_photos?: string[];
}

export interface Attachment {
  id: number;
  step: string;
  file_name: string;
  file_type: string;
  created_at: string;
}

export interface ProcessingRecord {
  step: Step;
  action: string;
  handler: string;
  remark: string;
  anomaly_reason: string;
  timestamp: string;
}

export interface SafetyOrder {
  id: string;
  order_no: string;
  address: string;
  status: Status;
  current_step: Step;
  current_handler: string;
  deadline: string;
  expiry_status: ExpiryStatus;
  home_inspection: HomeInspection | null;
  hazard_rectification: HazardRectification | null;
  recheck_closure: RecheckClosure | null;
  processing_records: ProcessingRecord[];
  attachments?: Attachment[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  results: { order_id: string; order_no: string; success: boolean; message: string }[];
}

export interface OrderStats {
  pending_correction: number;
  under_review: number;
  completed: number;
  normal: number;
  near_expiry: number;
  overdue: number;
  by_handler: { handler: string; count: number }[];
}

export interface CreateOrderData {
  address: string;
  deadline: string;
  inspector: string;
}

export interface ActionData {
  action: string;
  role: string;
  handler: string;
  remark?: string;
  anomaly_reason?: string;
  version: number;
  attachments?: Attachment[];
  home_inspection?: Partial<HomeInspection>;
  hazard_rectification?: Partial<HazardRectification>;
  recheck_closure?: Partial<RecheckClosure>;
}

export interface BatchActionData {
  order_ids: string[];
  action: string;
  role: string;
  handler: string;
  remark?: string;
  attachments?: Attachment[];
}

export interface FetchOrdersParams {
  status?: Status;
  expiry_status?: ExpiryStatus;
  handler?: string;
  keyword?: string;
}
