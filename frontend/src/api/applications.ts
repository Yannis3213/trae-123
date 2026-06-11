import client from './client';
import type {
  ApplicationListResponse,
  Application,
  ProcessPayload,
  BatchProcessPayload,
  BatchProcessResponse,
  AllowedActionsResponse,
} from '../types';

export const getApplications = async (
  params?: Record<string, any>
): Promise<ApplicationListResponse> => {
  return client.get('/applications', { params });
};

export const getApplication = async (id: number): Promise<Application> => {
  return client.get(`/applications/${id}`);
};

export const processApplication = async (
  id: number,
  payload: ProcessPayload
): Promise<Application> => {
  return client.post(`/applications/${id}/process`, payload);
};

export const batchProcess = async (
  payload: BatchProcessPayload
): Promise<BatchProcessResponse> => {
  return client.post('/applications/batch-process', payload);
};

export const getAllowedActionsBatch = async (
  ids: number[]
): Promise<AllowedActionsResponse> => {
  return client.get('/applications/allowed-actions', { params: { ids: ids.join(',') } });
};
