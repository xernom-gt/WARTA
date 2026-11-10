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
  /**
   * Autentikasi warga menggunakan email dan password.
   * Mengembalikan access token JWT dan info singkat user.
   */
  async login(payload: LoginRequest): Promise<AuthToken> {
    const res = await api.post<ApiResponse<AuthToken>>('/auth/login', payload);
    return res.data.data;
  },

  /**
   * Pendaftaran akun warga baru.
   */
  async register(payload: RegisterRequest): Promise<UserPrivate> {
    const res = await api.post<ApiResponse<UserPrivate>>('/auth/register', payload);
    return res.data.data;
  },

  /**
   * Mengambil profil lengkap akun yang sedang login (membutuhkan Bearer token).
   */
  async getMe(): Promise<UserPrivate> {
    const res = await api.get<ApiResponse<UserPrivate>>('/auth/me');
    return res.data.data;
  },

  /**
   * Mencabut token aktif di server (blacklist token).
   */
  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  /**
   * Mengirim ulang email verifikasi akun (batas 3x/jam per akun).
   * Mengembalikan status 204 No Content jika sukses.
   */
  async resendVerification(): Promise<void> {
    await api.post('/auth/resend-verification');
  },
};
