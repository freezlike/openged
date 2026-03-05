import { api } from './client';
import { AuditEvent } from '../types/domain';

export async function getAudit(params: Record<string, string>) {
  const { data } = await api.get<AuditEvent[]>('/admin/audit', { params });
  return data;
}
