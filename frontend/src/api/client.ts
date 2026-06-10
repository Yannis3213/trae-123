import axios from 'axios';
import { message } from 'antd';
import { getUserInfo, ERROR_CODE_MAP } from '../constants';
import type { ApiResponse } from '../types';

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const userInfo = getUserInfo();
  if (userInfo.role) {
    config.headers['X-Role'] = userInfo.role;
  }
  if (userInfo.userId) {
    config.headers['X-User-Id'] = userInfo.userId;
  }
  if (userInfo.userName) {
    config.headers['X-User-Name'] = userInfo.userName;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResponse<unknown>;
    if (data.code && data.code !== 0 && data.code !== 200) {
      const errorMsg = ERROR_CODE_MAP[data.code] || data.message || '操作失败';
      message.error(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const data = error.response.data as ApiResponse<unknown>;
      if (data?.code) {
        const errorMsg = ERROR_CODE_MAP[data.code] || data.message || '操作失败';
        message.error(errorMsg);
      } else {
        message.error(error.response.statusText || '请求失败');
      }
    } else {
      message.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  },
);

export default client;
