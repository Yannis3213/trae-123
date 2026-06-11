import client from './client';
import type { StatisticsData } from '../../types';

export const statisticsApi = {
  getStats: (): Promise<StatisticsData> => {
    return client.get('/statistics');
  },
};

export default statisticsApi;
