import { request } from './request';
import type {
  LoginRequest,
  User,
  TreatmentPlanItem,
  TreatmentPlanDetail,
  ProcessRequest,
  BatchProcessRequest,
  StatisticsData,
  ListQueryParams,
  ApiResponse,
  CorrectionRequest,
} from '@/types';

export async function login(params: LoginRequest): Promise<ApiResponse<User>> {
  return request<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getPlanList(
  params: ListQueryParams = {}
): Promise<ApiResponse<TreatmentPlanItem[]>> {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.deadlineWarning) query.append('deadlineWarning', params.deadlineWarning);
  if (params.search) query.append('search', params.search);
  const qs = query.toString();
  return request<TreatmentPlanItem[]>(
    `/treatment-plans${qs ? `?${qs}` : ''}`
  );
}

export async function getPlanDetail(
  id: string
): Promise<ApiResponse<TreatmentPlanDetail>> {
  return request<TreatmentPlanDetail>(`/treatment-plans/${id}`);
}

export async function processPlan(
  params: ProcessRequest
): Promise<ApiResponse<{ version: number }>> {
  return request<{ version: number }>('/treatment-plans/process', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function batchProcessPlans(
  params: BatchProcessRequest
): Promise<ApiResponse<{ results: Array<{ id: number; success: boolean; reason?: string }> }>> {
  return request('/treatment-plans/batch-process', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function submitCorrection(
  params: CorrectionRequest
): Promise<ApiResponse<unknown>> {
  return request('/treatment-plans/correct', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function addAuditNote(
  planId: string,
  note: string
): Promise<ApiResponse<unknown>> {
  return request('/treatment-plans/audit-note', {
    method: 'POST',
    body: JSON.stringify({ planId: Number(planId), note }),
  });
}

export async function getStatistics(): Promise<ApiResponse<StatisticsData>> {
  return request<StatisticsData>('/statistics');
}

export async function getDueWarningList(): Promise<
  ApiResponse<{
    normal: TreatmentPlanItem[];
    approaching: TreatmentPlanItem[];
    overdue: TreatmentPlanItem[];
  }>
> {
  return request('/statistics/due-warning');
}
