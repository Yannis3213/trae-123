import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import {
  WorkOrder, WorkOrderDetail, Statistics, Attachment,
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

  uploadAttachment(workOrderId: number, file: File, evidenceType: string): Observable<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('evidence_type', evidenceType);
    return this.http.post<Attachment>(`/api/workorders/${workOrderId}/attachments`, formData);
  }

  getAttachments(workOrderId: number): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`/api/workorders/${workOrderId}/attachments`);
  }

  downloadAttachment(attachmentId: number): Observable<{ success: boolean; blob?: Blob; fileName?: string; error?: string; status?: number }> {
    return this.http.get(`/api/attachments/${attachmentId}/download`, {
      observe: 'response',
      responseType: 'blob'
    }).pipe(
      map((resp: HttpResponse<Blob>) => {
        let fileName = `attachment_${attachmentId}`;
        const disposition = resp.headers.get('Content-Disposition');
        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) {
            try {
              fileName = decodeURIComponent(match[1]);
            } catch {
              fileName = match[1];
            }
          }
        }
        return { success: true, blob: resp.body!, fileName, status: resp.status };
      }),
      catchError((err: HttpErrorResponse) => {
        return this.parseBlobError(err).pipe(
          switchMap(errorMsg => of({
            success: false,
            error: errorMsg || '下载失败',
            status: err.status
          }))
        );
      })
    );
  }

  private parseBlobError(err: HttpErrorResponse): Observable<string> {
    if (err.error instanceof Blob) {
      return new Observable<string>(subscriber => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result as string);
            subscriber.next(parsed.error || err.statusText || '');
          } catch {
            subscriber.next(err.statusText || '');
          }
          subscriber.complete();
        };
        reader.onerror = () => {
          subscriber.next(err.statusText || '');
          subscriber.complete();
        };
        reader.readAsText(err.error);
      });
    }
    if (typeof err.error === 'string') {
      return of(err.error);
    }
    if (err.error?.error) {
      return of(err.error.error);
    }
    return of(err.statusText || '');
  }
}
