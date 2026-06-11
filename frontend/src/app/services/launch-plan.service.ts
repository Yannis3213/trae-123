import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import {
  LaunchPlan,
  Attachment,
  ProcessRecord,
  AuditNote,
  ExceptionLog,
  Stats,
  BatchResult,
  ListResponse,
  DetailResponse,
} from '../models/launch-plan';

@Injectable({ providedIn: 'root' })
export class LaunchPlanService {
  private base = '/api';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers() {
    return new HttpHeaders(this.auth.getHeaders());
  }

  getList(params?: {
    status?: string;
    priority?: string;
    owner?: string;
    warning?: string;
    keyword?: string;
  }) {
    let p = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) p = p.set(k, v);
      });
    }
    return this.http.get<ListResponse<LaunchPlan>>(`${this.base}/launch-plans`, {
      headers: this.headers(),
      params: p,
    });
  }

  getStats() {
    return this.http.get<Stats>(`${this.base}/launch-plans/stats`, {
      headers: this.headers(),
    });
  }

  getDetail(id: string) {
    return this.http.get<DetailResponse>(`${this.base}/launch-plans/${id}`, {
      headers: this.headers(),
    });
  }

  create(data: any) {
    return this.http.post<{ id: string; plan_no: string }>(
      `${this.base}/launch-plans`,
      data,
      { headers: this.headers() }
    );
  }

  update(id: string, data: any) {
    return this.http.put<{ message: string; new_version: number }>(
      `${this.base}/launch-plans/${id}`,
      data,
      { headers: this.headers() }
    );
  }

  submit(id: string, version: number, comment?: string, evidence?: string) {
    return this.http.post<{ message: string; new_version: number }>(
      `${this.base}/launch-plans/${id}/submit`,
      { version, comment, evidence },
      { headers: this.headers() }
    );
  }

  reject(id: string, version: number, reject_reason: string, comment?: string) {
    return this.http.post<{ message: string; new_version: number }>(
      `${this.base}/launch-plans/${id}/reject`,
      { version, reject_reason, comment },
      { headers: this.headers() }
    );
  }

  archive(id: string, version: number, result: string, audit_note?: string, evidence?: string) {
    return this.http.post<{ message: string; new_version: number }>(
      `${this.base}/launch-plans/${id}/archive`,
      { version, result, audit_note, evidence },
      { headers: this.headers() }
    );
  }

  assign(id: string, assignee: string, version: number, comment?: string) {
    return this.http.post<{ message: string; new_version: number }>(
      `${this.base}/launch-plans/${id}/assign`,
      { assignee, version, comment },
      { headers: this.headers() }
    );
  }

  accept(id: string, version: number, comment?: string) {
    return this.http.post<{ message: string; new_version: number }>(
      `${this.base}/launch-plans/${id}/accept`,
      { version, comment },
      { headers: this.headers() }
    );
  }

  batchAdvance(ids: string[], target_status: string, comment?: string) {
    return this.http.post<BatchResult>(
      `${this.base}/launch-plans/batch-advance`,
      { ids, target_status, comment },
      { headers: this.headers() }
    );
  }

  uploadAttachment(id: string, files: FileList | File[]) {
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('files', f));
    return this.http.post<{ uploaded: number; files: any[] }>(
      `${this.base}/launch-plans/${id}/attachments`,
      fd,
      { headers: this.auth.getHeaders() }
    );
  }

  deleteAttachment(id: string) {
    return this.http.delete<{ success: boolean }>(`${this.base}/attachments/${id}`, {
      headers: this.headers(),
    });
  }

  addAuditNote(id: string, note: string) {
    return this.http.post<{ id: string }>(
      `${this.base}/launch-plans/${id}/audit-notes`,
      { note },
      { headers: this.headers() }
    );
  }

  getUsers() {
    return this.http.get<[]>(`${this.base}/users`, { headers: this.headers() });
  }

  getMe() {
    return this.http.get(`${this.base}/me`, { headers: this.headers() });
  }
}
