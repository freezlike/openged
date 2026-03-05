import { api } from './client';
import { LibraryItemsResponse, SiteSummary } from '../types/domain';

export async function listSites() {
  const { data } = await api.get<SiteSummary[]>('/dms/sites');
  return data;
}

export async function getLibraryItems(params: {
  libraryId: string;
  folderId?: string;
  q?: string;
  status?: string;
  contentType?: string;
  confidentiality?: string;
  ownerId?: string;
  author?: string;
  modifiedFrom?: string;
  modifiedTo?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'title';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}) {
  const { libraryId, ...query } = params;

  const { data } = await api.get<LibraryItemsResponse>(`/dms/libraries/${libraryId}/items`, {
    params: query,
  });

  return data;
}

export async function createFolder(libraryId: string, payload: { name: string; parentId?: string }) {
  const { data } = await api.post(`/dms/libraries/${libraryId}/folders`, payload);
  return data;
}
