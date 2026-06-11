import client from './client';
import type { User, LoginPayload, LoginResponse } from '../types';

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  return client.post('/auth/login', payload);
};

export const getMe = async (): Promise<User> => {
  return client.get('/auth/me');
};
