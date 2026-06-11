import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import {
  LoanApplication,
  Attachment,
  ProcessingRecord,
  AuditNote,
  ExceptionReason,
  BatchResult,
  Stats
} from '../models/loan.model';

const API_URL = 'http://localhost:8004/api';

@Injectable({ providedIn: 'root' })
export class LoanService {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private getOptions() {
    return { headers: this.auth.getAuthHeaders() };
  }

  getApplications(params?: any): Observable<LoanApplication[]> {
    let url = `${API_URL}/applications`;
    if (params) {
      const query = new URLSearchParams(params).toString();
      if (query) url += `?${query}`;
    }
    return this.http.get<LoanApplication[]>(url, this.getOptions());
  }

  getStats(): Observable<Stats> {
    return this.http.get<Stats>(`${API_URL}/applications/stats`, this.getOptions());
  }

  getApplication(id: number): Observable<LoanApplication> {
    return this.http.get<LoanApplication>(`${API_URL}/applications/${id}`, this.getOptions());
  }

  createApplication(data: any): Observable<any> {
    return this.http.post(`${API_URL}/applications`, data, this.getOptions());
  }

  submitApplication(id: number, version?: number, remark?: string): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/submit`, { version, remark }, this.getOptions());
  }

  verifyApplication(id: number, action: string, version?: number, remark?: string): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/verify`, { action, version, remark }, this.getOptions());
  }

  approveApplication(id: number, action: string, version?: number, remark?: string): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/approve`, { action, version, remark }, this.getOptions());
  }

  completeApplication(id: number, version?: number): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/complete`, { version }, this.getOptions());
  }

  batchVerify(ids: number[], action: string, remark?: string): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${API_URL}/batch/verify`, { ids, action, remark }, this.getOptions());
  }

  batchApprove(ids: number[], action: string, remark?: string): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${API_URL}/batch/approve`, { ids, action, remark }, this.getOptions());
  }

  batchArchive(ids: number[], remark?: string): Observable<BatchResult> {
    return this.http.post<BatchResult>(`${API_URL}/batch/archive`, { ids, remark }, this.getOptions());
  }

  archiveApplication(id: number, version?: number): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/archive`, { version }, this.getOptions());
  }

  unarchiveApplication(id: number, version?: number): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/unarchive`, { version }, this.getOptions());
  }

  resolveException(appId: number, excId: number, resolution: string, version?: number): Observable<any> {
    return this.http.post(`${API_URL}/applications/${appId}/exception/${excId}/resolve`, { resolution, version }, this.getOptions());
  }

  addReview(id: number, note: string, version?: number): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/review`, { note, version }, this.getOptions());
  }

  getAttachments(id: number): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`${API_URL}/applications/${id}/attachments`, this.getOptions());
  }

  addAttachment(id: number, data: any): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/attachments`, data, this.getOptions());
  }

  getRecords(id: number): Observable<ProcessingRecord[]> {
    return this.http.get<ProcessingRecord[]>(`${API_URL}/applications/${id}/records`, this.getOptions());
  }

  addAuditNote(id: number, note: string): Observable<any> {
    return this.http.post(`${API_URL}/applications/${id}/audit-notes`, { note }, this.getOptions());
  }

  getMeta(): Observable<any> {
    return this.http.get(`${API_URL}/meta`, this.getOptions());
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${API_URL}/users`, this.getOptions());
  }
}
