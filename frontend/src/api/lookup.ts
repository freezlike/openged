import { api } from './client';

export type LookupEntity = 'users' | 'groups' | 'documents' | 'taxonomy' | 'tags' | 'departments';

export interface LookupItem {
  id: string;
  label: string;
}

export async function searchLookup(
  entity: LookupEntity,
  params?: {
    q?: string;
    taxonomy?: string;
    activeOnly?: boolean;
  },
) {
  const { data } = await api.get<LookupItem[]>(`/lookup/${entity}`, { params });
  return data;
}

export async function createLookupValue(
  entity: LookupEntity,
  payload: { label: string; taxonomy?: string },
) {
  const { data } = await api.post<LookupItem>(`/lookup/${entity}`, payload);
  return data;
}
