import client from './client';
import type {
  Application,
  ApplicationListParams,
  ApplicationListResponse,
  ProcessPayload,
  BatchProcessPayload,
  BatchProcessResponse,
} from '../types';

export const getApplications = async (
  params?: ApplicationListParams
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
