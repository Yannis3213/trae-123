import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  WorkOrder, WorkOrderDetail, Statistics,
  BatchOperationRequest, BatchOperationResponse,
  WorkOrderCreateRequest, WorkOrderProcessRequest
} from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getStatistics(): Observable<Statistics> {
    return this.http.get<Statistics>('/api/statistics');
  }

  getWorkOrderList(params: {
    page?: number;
    page_size?: number;
    status?: string;
    appointment_clue?: string;
    warning_level?: string;
    license_plate?: string;
  } = {}): Observable<{ list: WorkOrder[]; total: number; page: number; size: number }> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<{ list: WorkOrder[]; total: number; page: number; size: number }>(
      '/api/workorders',
      { params: httpParams }
    );
  }

  getWorkOrderDetail(id: number): Observable<WorkOrderDetail> {
    return this.http.get<WorkOrderDetail>(`/api/workorders/${id}`);
  }

  createWorkOrder(req: WorkOrderCreateRequest): Observable<WorkOrder> {
    return this.http.post<WorkOrder>('/api/workorders', req);
  }

  processWorkOrder(id: number, req: WorkOrderProcessRequest): Observable<WorkOrderDetail> {
    return this.http.post<WorkOrderDetail>(`/api/workorders/${id}/process`, req);
  }

  batchProcess(req: BatchOperationRequest): Observable<BatchOperationResponse> {
    return this.http.post<BatchOperationResponse>('/api/workorders/batch', req);
  }

  addAuditNote(id: number, note: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`/api/workorders/${id}/notes`, { note });
  }

  getCurrentUser(): Observable<any> {
    return this.http.get('/api/user/me');
  }
}
