import client from './client';
import type {
  LegalCase,
  CaseDetail,
  CaseListRequest,
  CaseListResponse,
  CaseActionRequest,
  ProcessingRecord,
} from '../../types';

export interface CreateCaseRequest {
  title: string;
  priority?: string;
  deadline?: string;
}

export interface UpdateCaseRequest {
  title?: string;
  priority?: string;
  deadline?: string;
  version: number;
}

export const casesApi = {
  getList: (params: CaseListRequest): Promise<CaseListResponse> => {
    return client.get('/cases', { params });
  },

  getDetail: (id: number): Promise<CaseDetail> => {
    return client.get(`/cases/${id}`);
  },

  create: (data: CreateCaseRequest): Promise<LegalCase> => {
    return client.post('/cases', data);
  },

  update: (id: number, data: UpdateCaseRequest): Promise<LegalCase> => {
    return client.put(`/cases/${id}`, data);
  },

  remove: (id: number): Promise<void> => {
    return client.delete(`/cases/${id}`);
  },

  action: (data: CaseActionRequest): Promise<LegalCase> => {
    return client.post('/cases/action', data);
  },

  getProcessingRecords: (id: number): Promise<ProcessingRecord[]> => {
    return client.get(`/cases/${id}/records`);
  },
};

export default casesApi;
