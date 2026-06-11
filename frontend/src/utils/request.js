import axios from 'axios';
import { ElMessage } from 'element-plus';
import { API_BASE_URL } from './config';

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code === 200) {
      return res;
    } else {
      ElMessage.error(res.message || '请求失败');
      return Promise.reject(new Error(res.message || '请求失败'));
    }
  },
  (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        ElMessage.error('登录已过期，请重新登录');
        window.location.href = '/login';
      } else if (status === 403) {
        ElMessage.error('权限不足，无法执行此操作');
      } else if (status === 404) {
        ElMessage.error('请求的资源不存在');
      } else {
        ElMessage.error(error.response.data?.message || '服务器错误');
      }
    } else {
      ElMessage.error('网络错误，请检查网络连接');
    }
    return Promise.reject(error);
  }
);

export default request;
