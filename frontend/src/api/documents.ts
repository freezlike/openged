import { api } from './client';
import { AuditEvent, DocumentDetails, WorkflowHistoryItem } from '../types/domain';

export async function uploadDocument(payload: {
  file: File;
  libraryId: string;
  folderId?: string;
  title?: string;
  comment?: string;
}) {
  const formData = new FormData();
  formData.set('file', payload.file);
  formData.set('libraryId', payload.libraryId);

  if (payload.folderId) {
    formData.set('folderId', payload.folderId);
  }

  if (payload.title) {
    formData.set('title', payload.title);
  }

  if (payload.comment) {
    formData.set('comment', payload.comment);
  }

  const { data } = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

export async function checkoutDocument(documentId: string) {
  const { data } = await api.post(`/documents/${documentId}/checkout`);
  return data;
}

export async function checkinDocument(payload: {
  documentId: string;
  file: File;
  versionType: 'major' | 'minor';
  comment: string;
}) {
  const formData = new FormData();
  formData.set('file', payload.file);
  formData.set('versionType', payload.versionType);
  formData.set('comment', payload.comment);

  const { data } = await api.post(`/documents/${payload.documentId}/checkin`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return data;
}

export async function updateDocumentMetadata(
  documentId: string,
  fields: Array<{ fieldId: string; value: unknown }>,
) {
  const { data } = await api.put(`/documents/${documentId}/metadata`, { fields });
  return data;
}

export async function listVersions(documentId: string) {
  const { data } = await api.get(`/documents/${documentId}/versions`);
  return data;
}

export async function getDocumentDetails(documentId: string) {
  const { data } = await api.get<DocumentDetails>(`/documents/${documentId}`);
  return data;
}

export async function getDocumentActivity(documentId: string) {
  const { data } = await api.get<AuditEvent[]>(`/documents/${documentId}/activity`);
  return data;
}

export async function getDocumentWorkflowHistory(documentId: string) {
  const { data } = await api.get<WorkflowHistoryItem[]>(`/documents/${documentId}/workflows/history`);
  return data;
}

export async function downloadDocument(documentId: string) {
  const response = await api.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  });

  return response.data as Blob;
}

export async function deleteDocuments(ids: string[]) {
  const { data } = await api.post('/documents/bulk-delete', { ids });
  return data;
}
