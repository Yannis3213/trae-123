import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CheckinRecord,
  RecordDetail,
  BatchProcessResult,
  Statistics,
  Attachment,
  AuditNote,
  ExceptionReason,
  ProcessAction,
  AttachmentType,
} from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  private authHeaders(): { [header: string]: string } {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  getRecords(params: {
    status?: string;
    current_handler_role?: string;
    flight_no?: string;
    passenger_name?: string;
    page?: number;
    page_size?: number;
    warning_type?: string;
  } = {}): Observable<{ data: CheckinRecord[]; total: number; page: number; page_size: number }> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.current_handler_role) httpParams = httpParams.set('current_handler_role', params.current_handler_role);
    if (params.flight_no) httpParams = httpParams.set('flight_no', params.flight_no);
    if (params.passenger_name) httpParams = httpParams.set('passenger_name', params.passenger_name);
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.page_size) httpParams = httpParams.set('page_size', params.page_size.toString());
    if (params.warning_type) httpParams = httpParams.set('warning_type', params.warning_type);
    return this.http.get<{ data: CheckinRecord[]; total: number; page: number; page_size: number }>('/api/records', {
      params: httpParams,
      headers: this.authHeaders(),
    });
  }

  getRecordDetail(id: number): Observable<RecordDetail> {
    return this.http.get<RecordDetail>(`/api/records/${id}`, { headers: this.authHeaders() });
  }

  createRecord(data: {
    flight_no: string;
    passenger_name: string;
    passenger_id: string;
    seat_no?: string;
    checkin_time?: string;
    deadline?: string;
  }): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>('/api/records', data, { headers: this.authHeaders() });
  }

  processRecord(id: number, action: ProcessAction, comment: string, version: number): Observable<{ message: string; new_status: string }> {
    return this.http.put<{ message: string; new_status: string }>(`/api/records/${id}/process`, { action, comment, version }, { headers: this.authHeaders() });
  }

  batchProcess(recordIds: number[], action: ProcessAction, comment: string, version: number = 0, recordVersions?: Record<number, number>): Observable<{ results: BatchProcessResult[] }> {
    const body: any = { record_ids: recordIds, action, comment, version };
    if (recordVersions && Object.keys(recordVersions).length > 0) {
      body.record_versions = recordVersions;
    }
    return this.http.post<{ results: BatchProcessResult[] }>('/api/records/batch', body, { headers: this.authHeaders() });
  }

  getStatistics(): Observable<Statistics> {
    return this.http.get<Statistics>('/api/records/statistics', { headers: this.authHeaders() });
  }

  getWarnings(warningType?: string, page?: number, pageSize?: number): Observable<{ data: any[]; total: number; page: number; page_size: number }> {
    let params = new HttpParams();
    if (warningType) params = params.set('warning_type', warningType);
    if (page) params = params.set('page', page.toString());
    if (pageSize) params = params.set('page_size', pageSize.toString());
    return this.http.get<{ data: any[]; total: number; page: number; page_size: number }>('/api/warnings', { params, headers: this.authHeaders() });
  }

  uploadAttachment(recordId: number, type: AttachmentType, fileName: string): Observable<{ id: number; message: string }> {
    const body = new HttpParams().set('type', type).set('file_name', fileName);
    return this.http.post<{ id: number; message: string }>(`/api/records/${recordId}/attachments`, body.toString(), {
      headers: { ...this.authHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  getAttachments(recordId: number): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`/api/records/${recordId}/attachments`, { headers: this.authHeaders() });
  }

  deleteAttachment(recordId: number, attachmentId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/records/${recordId}/attachments/${attachmentId}`, { headers: this.authHeaders() });
  }

  getAuditNotes(recordId: number): Observable<AuditNote[]> {
    return this.http.get<AuditNote[]>(`/api/records/${recordId}/audit-notes`, { headers: this.authHeaders() });
  }

  addAuditNote(recordId: number, note: string): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(`/api/records/${recordId}/audit-notes`, { note }, { headers: this.authHeaders() });
  }

  getExceptionReasons(recordId: number): Observable<ExceptionReason[]> {
    return this.http.get<ExceptionReason[]>(`/api/records/${recordId}/exception-reasons`, { headers: this.authHeaders() });
  }

  addExceptionReason(recordId: number, reasonType: string, description: string): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(`/api/records/${recordId}/exception-reasons`, { reason_type: reasonType, description }, { headers: this.authHeaders() });
  }
}
