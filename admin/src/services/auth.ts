import { api } from './api';
import type { components } from '../types/api';

export type LoginRequest = components['schemas']['LoginRequest'];
export type RegisterRequest = components['schemas']['RegisterRequest'];
export type AuthToken = components['schemas']['AuthToken'];
export type UserPrivate = components['schemas']['UserPrivate'];

export interface ApiResponse<T> {
  data: T;
}

export const authService = {
  async login(payload: LoginRequest): Promise<AuthToken> {
    const { data } = await api.post<ApiResponse<AuthToken>>('/auth/login', payload);
    if (data?.data?.access_token) {
      localStorage.setItem('token', data.data.access_token);
    }
    return data.data;
  },

  async register(payload: RegisterRequest): Promise<UserPrivate> {
    const { data } = await api.post<ApiResponse<UserPrivate>>('/auth/register', payload);
    return data.data;
  },

  async getMe(): Promise<UserPrivate> {
    const { data } = await api.get<ApiResponse<UserPrivate>>('/auth/me');
    return data.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('token');
    }
  },
};

