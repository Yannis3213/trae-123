import client from './client';
import type {
  Application,
  AuditLog,
  BatchResult,
  BatchApplicationItem,
  BatchProcessResultData,
  Statistics,
  PaginatedResponse,
  ExpiryStatus,
  ApplicationStatus,
} from '../types';

interface ApplicationQueryParams {
  page?: number;
  page_size?: number;
  status?: ApplicationStatus;
  expiry_status?: ExpiryStatus;
  keyword?: string;
}

interface ProcessData {
  action: string;
  version?: number;
  remark?: string;
  exception_reason?: string;
  sub_module?: string;
  sub_module_status?: string;
}

interface BatchProcessData {
  application_ids?: string[];
  application_items?: BatchApplicationItem[];
  action: string;
  remark?: string;
  exception_reason?: string;
}

interface CreateApplicationData {
  tenant_name: string;
  tenant_phone: string;
  room_number: string;
  building_name: string;
  lease_start_date: string;
  lease_end_date: string;
  monthly_rent: number;
  deposit: number;
}

interface UpdateApplicationData extends Partial<CreateApplicationData> {
  version: number;
}

export async function getApplications(params: ApplicationQueryParams) {
  const res = await client.get<{ data: PaginatedResponse<Application> }>('/applications', { params });
  return res.data.data;
}

export async function getApplication(id: string) {
  const res = await client.get<{ data: Application }>(`/applications/${id}`);
  return res.data.data;
}

export async function createApplication(data: CreateApplicationData) {
  const res = await client.post<{ data: Application }>('/applications', data);
  return res.data.data;
}

export async function updateApplication(id: string, data: UpdateApplicationData) {
  const res = await client.put<{ data: Application }>(`/applications/${id}`, data);
  return res.data.data;
}

export interface ProcessResponse {
  status: ApplicationStatus;
  version: number;
  confirmed: boolean;
  next_handler_role: string;
  next_handler_id: string;
  next_handler_name: string;
}

export async function processApplication(id: string, data: ProcessData) {
  const res = await client.post<{ data: ProcessResponse }>(`/applications/${id}/process`, data);
  return res.data.data;
}

export async function batchProcess(data: BatchProcessData) {
  const res = await client.post<{ data: BatchProcessResultData }>('/applications/batch', data);
  return res.data.data;
}

export async function getAuditTrail(id: string) {
  const res = await client.get<{ data: AuditLog[] }>(`/applications/${id}/audit`);
  return res.data.data;
}

export async function uploadAttachment(id: string, formData: FormData) {
  const res = await client.post<{ data: unknown }>(`/applications/${id}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function exportApplications(params: ApplicationQueryParams) {
  const res = await client.get('/export', { params, responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `租约申请_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getExpiryWarnings(params?: { expiry_status?: ExpiryStatus; page?: number; page_size?: number }) {
  const res = await client.get<{ data: Application[] }>('/expiry-warnings', { params });
  return res.data.data;
}

export async function getStatistics() {
  const res = await client.get<{ data: Statistics }>('/statistics');
  return res.data.data;
}
