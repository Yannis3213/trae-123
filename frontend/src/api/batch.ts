import client from './client';
import type { BatchProcessRequest, BatchResult } from '../../types';

export const batchApi = {
  process: (data: BatchProcessRequest): Promise<BatchResult[]> => {
    return client.post('/cases/batch', data);
  },
};

export default batchApi;
