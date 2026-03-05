import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { completeTask, listMyTasks } from '../api/workflow';
import { TaskPanel } from '../components/workflow/task-panel';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { formatDate } from '../lib/utils';
import { MyTask } from '../types/domain';

export function TasksPage() {
  const { t } = useTranslation(['workflow', 'common']);
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState<'dueSoon' | 'overdue' | 'completed' | 'ALL'>('ALL');
  const [status, setStatus] = useState<'OPEN' | 'COMPLETED' | 'REJECTED' | 'CANCELED' | 'ALL'>('ALL');
  const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);

  const tasksQuery = useQuery({
    queryKey: ['my-tasks', preset, status],
    queryFn: () =>
      listMyTasks({
        preset: preset === 'ALL' ? undefined : preset,
        status: status === 'ALL' ? undefined : status,
      }),
  });

  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      setSelectedTask(null);
    },
  });

  const grouped = useMemo(() => {
    const now = new Date();

    return (tasksQuery.data ?? []).map((task) => ({
      ...task,
      overdue: Boolean(task.dueDate && new Date(task.dueDate) < now && task.status === 'OPEN'),
      dueSoon: Boolean(
        task.dueDate &&
          new Date(task.dueDate) >= now &&
          new Date(task.dueDate).getTime() - now.getTime() < 2 * 24 * 60 * 60 * 1000,
      ),
    }));
  }, [tasksQuery.data]);

  return (
    <Card className="flex min-h-[calc(100vh-7.5rem)] overflow-hidden xl:h-[calc(100vh-7.5rem)]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[#e2e8f0] px-4 py-3">
          <h1 className="text-lg font-semibold text-[#0f172a]">{t('workflow:tasks.title')}</h1>
          <p className="text-sm text-[#64748b]">{t('workflow:tasks.description')}</p>
        </div>

        <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-white px-3 py-2">
          <Select value={preset} onValueChange={(value) => setPreset(value as typeof preset)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('workflow:tasks.allPresets')}</SelectItem>
              <SelectItem value="dueSoon">{t('workflow:tasks.dueSoon')}</SelectItem>
              <SelectItem value="overdue">{t('workflow:tasks.overdue')}</SelectItem>
              <SelectItem value="completed">{t('workflow:tasks.completed')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('workflow:tasks.allStatuses')}</SelectItem>
              <SelectItem value="OPEN">{t('workflow:tasks.open')}</SelectItem>
              <SelectItem value="COMPLETED">{t('workflow:tasks.completed')}</SelectItem>
              <SelectItem value="REJECTED">{t('workflow:tasks.rejected')}</SelectItem>
              <SelectItem value="CANCELED">{t('workflow:tasks.canceled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#e2e8f0] text-xs uppercase tracking-wide text-[#64748b]">
                <th className="px-3 py-2">{t('workflow:tasks.document')}</th>
                <th className="px-3 py-2">{t('workflow:tasks.state')}</th>
                <th className="px-3 py-2">{t('workflow:tasks.due')}</th>
                <th className="px-3 py-2">{t('workflow:tasks.status')}</th>
                <th className="px-3 py-2">{t('workflow:tasks.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((task) => (
                <tr key={task.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-3 py-2">
                    <Link to={`/documents/${task.document.id}/preview`} className="font-medium text-[#1d4ed8] hover:underline">
                      {task.document.title}
                    </Link>
                    <p className="text-xs text-[#64748b]">
                      {task.document.site.name} / {task.document.library.name}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#334155]">{task.workflow.state}</td>
                  <td className="px-3 py-2 text-xs text-[#334155]">{formatDate(task.dueDate)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={task.status === 'OPEN' ? 'warning' : 'muted'}>{task.status}</Badge>
                      {task.overdue ? <Badge variant="danger">{t('workflow:tasks.overdue')}</Badge> : null}
                      {task.dueSoon && !task.overdue ? (
                        <Badge variant="default">{t('workflow:tasks.dueSoon')}</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Button variant="secondary" size="sm" onClick={() => setSelectedTask(task)}>
                      {t('workflow:tasks.review')}
                    </Button>
                  </td>
                </tr>
              ))}

              {grouped.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-sm text-[#64748b]" colSpan={5}>
                    {t('workflow:tasks.noTasks')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <TaskPanel
        open={Boolean(selectedTask)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
          }
        }}
        task={selectedTask}
        onDecision={async (decision, comment) => {
          if (!selectedTask) {
            return;
          }

          await completeMutation.mutateAsync({
            taskId: selectedTask.id,
            status: decision,
            comment,
          });
        }}
      />
    </Card>
  );
}
