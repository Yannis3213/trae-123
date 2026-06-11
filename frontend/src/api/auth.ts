import client from './client';
import type { LoginResponse, User } from '../../types';

export interface LoginRequest {
  username: string;
  password: string;
}

export const authApi = {
  login: (data: LoginRequest): Promise<LoginResponse> => {
    return client.post('/auth/login', data);
  },

  getCurrentUser: (): Promise<User> => {
    return client.get('/auth/me');
  },

  logout: (): Promise<void> => {
    return client.post('/auth/logout');
  },
};

export default authApi;
