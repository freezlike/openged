import { api } from './client';
import { AdminRole, AdminUsersResponse, AuditEvent } from '../types/domain';

export async function getAudit(params: Record<string, string>) {
  const { data } = await api.get<AuditEvent[]>('/admin/audit', { params });
  return data;
}

export async function getAdminRoles() {
  const { data } = await api.get<AdminRole[]>('/admin/roles');
  return data;
}

export async function getAdminUsers(params: { q?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get<AdminUsersResponse>('/admin/users', { params });
  return data;
}

export async function createAdminUser(payload: {
  email: string;
  password: string;
  status?: 'ACTIVE' | 'DISABLED' | 'PENDING';
  roles?: string[];
}) {
  const { data } = await api.post('/admin/users', payload);
  return data;
}

export async function updateAdminUserRoles(userId: string, roles: string[]) {
  const { data } = await api.put(`/admin/users/${userId}/roles`, { roles });
  return data;
}
