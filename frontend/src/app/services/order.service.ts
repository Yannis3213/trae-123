import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Attachment {
  id: number;
  file_name: string;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
  description?: string;
}

export interface ProcessingRecord {
  id: number;
  order_id: number;
  action: string;
  operator: string;
  operator_role: string;
  previous_status?: string;
  new_status?: string;
  remark?: string;
  evidence_summary?: string;
  created_at: string;
}

export interface AuditNote {
  id: number;
  order_id: number;
  note: string;
  noted_by: string;
  noted_at: string;
}

export interface ExceptionReason {
  id: number;
  order_id: number;
  category: string;
  reason: string;
  reported_by: string;
  reported_at: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  resolution_note?: string;
}

export interface TransportOrder {
  id: number;
  order_no: string;
  status: string;
  priority: string;
  responsible_person: string;
  deadline: string;
  version: number;
  created_at: string;
  updated_at: string;
  current_handler: string;
  is_overdue: boolean;
  overdue_reason?: string;
  consignor_name?: string;
  consignor_contact?: string;
  consignor_phone?: string;
  consignee_name?: string;
  consignee_contact?: string;
  consignee_phone?: string;
  cargo_name?: string;
  cargo_weight?: string;
  cargo_volume?: string;
  cargo_quantity?: string;
  departure?: string;
  destination?: string;
  transport_requirements?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  driver_name?: string;
  driver_phone?: string;
  dispatch_time?: string;
  estimated_arrival?: string;
  receipt_signer?: string;
  receipt_time?: string;
  receipt_status?: string;
  receipt_remark?: string;
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exception_reasons: ExceptionReason[];
}

export interface OrderListResponse {
  items: TransportOrder[];
  total: number;
  page: number;
  page_size: number;
}

export interface OrderListFilter {
  status?: string;
  responsible_person?: string;
  priority?: string;
  deadline_from?: string;
  deadline_to?: string;
  page?: number;
  page_size?: number;
}

export interface OrderActionRequest {
  action: string;
  remark?: string;
  evidence_files?: Attachment[];
  expected_version?: number;
}

export interface BatchResultItem {
  order_id: number;
  order_no: string;
  success: boolean;
  message: string;
}

export interface BatchActionResponse {
  results: BatchResultItem[];
  total_success: number;
  total_failed: number;
}

export interface BatchActionRequest {
  order_ids: number[];
  action: string;
  remark?: string;
  expected_versions?: Record<string, number>;
}

export interface WarningGroup {
  group: string;
  orders: TransportOrder[];
  count: number;
}

export interface WarningResponse {
  normal: WarningGroup;
  approaching: WarningGroup;
  overdue: WarningGroup;
}

const API_BASE = '';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private http: HttpClient) {}

  listOrders(filter: OrderListFilter): Observable<OrderListResponse> {
    let params = new HttpParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<OrderListResponse>(`${API_BASE}/api/orders/`, { params });
  }

  getOrder(id: number): Observable<TransportOrder> {
    return this.http.get<TransportOrder>(`${API_BASE}/api/orders/${id}`);
  }

  createOrder(data: Partial<TransportOrder>): Observable<TransportOrder> {
    return this.http.post<TransportOrder>(`${API_BASE}/api/orders/`, data);
  }

  updateOrder(id: number, data: Partial<TransportOrder>): Observable<TransportOrder> {
    return this.http.put<TransportOrder>(`${API_BASE}/api/orders/${id}`, data);
  }

  processOrder(id: number, data: OrderActionRequest): Observable<TransportOrder> {
    return this.http.post<TransportOrder>(`${API_BASE}/api/orders/${id}/action`, data);
  }

  batchProcess(data: BatchActionRequest): Observable<BatchActionResponse> {
    return this.http.post<BatchActionResponse>(`${API_BASE}/api/orders/batch`, data);
  }

  getWarnings(): Observable<WarningResponse> {
    return this.http.get<WarningResponse>(`${API_BASE}/api/orders/warnings`);
  }

  addAuditNote(orderId: number, note: string): Observable<AuditNote> {
    return this.http.post<AuditNote>(`${API_BASE}/api/orders/${orderId}/audit-notes`, { note });
  }

  addException(orderId: number, category: string, reason: string): Observable<ExceptionReason> {
    return this.http.post<ExceptionReason>(`${API_BASE}/api/orders/${orderId}/exceptions`, { category, reason });
  }
}
