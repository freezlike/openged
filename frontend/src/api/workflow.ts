import { api } from './client';
import { MyTask, WorkflowTemplateSummary } from '../types/domain';

export async function startWorkflow(payload: {
  documentId: string;
  assignedUserId?: string;
  dueDate?: string;
  templateName?: string;
}) {
  const { data } = await api.post('/workflow/start', payload);
  return data;
}

export async function completeTask(payload: {
  taskId: string;
  status: 'COMPLETED' | 'REJECTED';
  comment?: string;
}) {
  const { data } = await api.post(`/tasks/${payload.taskId}/complete`, {
    status: payload.status,
    comment: payload.comment,
  });
  return data;
}

export async function listAvailableWorkflows(params: {
  libraryId?: string;
  contentTypeId?: string;
}) {
  const { data } = await api.get<WorkflowTemplateSummary[]>('/workflows/available', { params });
  return data;
}

export async function listMyTasks(params?: {
  status?: 'OPEN' | 'COMPLETED' | 'REJECTED' | 'CANCELED';
  preset?: 'dueSoon' | 'overdue' | 'completed';
}) {
  const { data } = await api.get<MyTask[]>('/tasks/my', { params });
  return data;
}
