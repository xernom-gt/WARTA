import { api } from './api';

export interface AuthUser {
  id: string;
  display_name: string;
  email: string;
  email_verified_at?: string | null;
}

export interface UserPrivate extends AuthUser {
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface RegisterRequest {
  display_name: string;
  email: string;
  password: string;
}

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<{ data: LoginResponse }>('/auth/login', payload);
    if (data?.data?.access_token) {
      localStorage.setItem('token', data.data.access_token);
    }
    return data.data;
  },

  async register(payload: RegisterRequest): Promise<UserPrivate> {
    const { data } = await api.post<{ data: UserPrivate }>('/auth/register', payload);
    return data.data;
  },

  async getMe(): Promise<UserPrivate> {
    const { data } = await api.get<{ data: UserPrivate }>('/auth/me');
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

