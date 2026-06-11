export class LoginDto {
  username: string;
  password: string;
}

export class CreateRecordDto {
  client_name: string;
  client_id_no: string;
  business_type: string;
  expiry_date: string;
  has_suitability_evidence: number;
  has_risk_assessment: number;
  has_business_opening: number;
  exception_reason?: string;
}

export class UpdateStatusDto {
  action: 'assign' | 'transfer' | 'review' | 'return';
  assigned_to?: number;
  comment?: string;
  version: number;
  review_opinion?: string;
  review_result?: 'approved' | 'rejected';
  correction_reason?: string;
}

export class BatchProcessDto {
  record_ids: number[];
  action: 'assign' | 'transfer' | 'review' | 'return';
  assigned_to?: number;
  comment?: string;
  review_opinion?: string;
  review_result?: 'approved' | 'rejected';
  correction_reason?: string;
}

export class BatchOverdueAdvanceDto {
  record_ids: number[];
  comment?: string;
}

export class AddAuditNoteDto {
  content: string;
}

export class AddAttachmentDto {
  file_name: string;
  file_type: string;
  category: 'suitability' | 'risk_assessment' | 'business_opening' | 'correction' | 'other';
}
