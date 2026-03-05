import { api } from './client';
import { LoginResponse } from '../types/models';

export async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
  return data;
}

export async function me() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function logout(refreshToken: string) {
  await api.post('/auth/logout', { refreshToken });
}

export async function getSsoProviders(): Promise<string[]> {
  const { data } = await api.get<string[]>('/auth/sso/providers');
  return data;
}
