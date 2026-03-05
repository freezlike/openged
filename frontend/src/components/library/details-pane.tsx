import { Activity, ClipboardList, FileClock, Info } from 'lucide-react';

import { MetadataForm } from './metadata-form';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { formatDate } from '../../lib/utils';
import { AuditEvent, DocumentDetails, WorkflowHistoryItem } from '../../types/domain';

interface DetailsPaneProps {
  document: DocumentDetails | null;
  activity: AuditEvent[];
  versions: Array<{ id: string; version: string; comment: string; createdAt: string; type: string }>;
  workflowHistory: WorkflowHistoryItem[];
  onUpdateMetadata: (fields: Array<{ fieldId: string; value: unknown }>) => Promise<void>;
  onStartWorkflow: () => void;
}

export function DetailsPane({
  document,
  activity,
  versions,
  workflowHistory,
  onUpdateMetadata,
  onStartWorkflow,
}: DetailsPaneProps) {
  if (!document) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[#64748b]">
        Select a document to view details.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l border-[#e2e8f0] bg-white">
      <div className="px-4 py-3">
        <p className="line-clamp-2 text-sm font-semibold text-[#0f172a]">{document.title}</p>
        <p className="mt-1 text-xs text-[#64748b]">Updated {formatDate(document.updatedAt)}</p>
      </div>

      <Separator />

      <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details" className="gap-1">
            <Info className="h-3.5 w-3.5" />
            Details
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1">
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1">
            <FileClock className="h-3.5 w-3.5" />
            Versions
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-1">
            <ClipboardList className="h-3.5 w-3.5" />
            Workflow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-17rem)] pr-2">
            <div className="space-y-4">
              <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-xs text-[#475569]">
                <p>
                  Site: <span className="font-medium text-[#0f172a]">{document.site.name}</span>
                </p>
                <p>
                  Library: <span className="font-medium text-[#0f172a]">{document.library.name}</span>
                </p>
                <p>
                  Created by: <span className="font-medium text-[#0f172a]">{document.createdBy.email}</span>
                </p>
                <p>
                  Status: <Badge variant="muted" className="ml-1">{document.status}</Badge>
                </p>
              </div>
              <MetadataForm document={document} onSubmit={onUpdateMetadata} />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="activity" className="min-h-0 flex-1">
          <ScrollArea className="h-[calc(100vh-17rem)] pr-2">
            <div className="space-y-3">
              {activity.map((event) => (
                <div key={event.id} className="rounded-lg border border-[#e2e8f0] p-2">
                  <p className="text-sm font-medium text-[#0f172a]">{event.eventType}</p>
                  <p className="text-xs text-[#64748b]">{formatDate(event.createdAt)}</p>
                  <p className="text-xs text-[#475569]">{event.actor?.email ?? 'System'}</p>
                </div>
              ))}
              {activity.length === 0 ? <p className="text-sm text-[#64748b]">No activity yet.</p> : null}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="versions" className="min-h-0 flex-1">
          <ScrollArea className="h-[calc(100vh-17rem)] pr-2">
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version.id} className="rounded-lg border border-[#e2e8f0] p-2">
                  <p className="text-sm font-semibold text-[#0f172a]">Version {version.version}</p>
                  <p className="text-xs text-[#64748b]">{version.type}</p>
                  <p className="text-xs text-[#475569]">{version.comment}</p>
                  <p className="text-xs text-[#64748b]">{formatDate(version.createdAt)}</p>
                </div>
              ))}
              {versions.length === 0 ? <p className="text-sm text-[#64748b]">No versions available.</p> : null}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="workflow" className="min-h-0 flex-1">
          <ScrollArea className="h-[calc(100vh-17rem)] pr-2">
            <div className="space-y-3">
              <button
                type="button"
                onClick={onStartWorkflow}
                className="w-full rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-left text-sm font-medium text-[#1d4ed8]"
              >
                Start workflow for this document
              </button>

              {workflowHistory.map((workflow) => (
                <div key={workflow.id} className="rounded-lg border border-[#e2e8f0] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#0f172a]">{workflow.state}</p>
                    <Badge variant={workflow.endedAt ? 'muted' : 'warning'}>
                      {workflow.endedAt ? 'Closed' : 'Active'}
                    </Badge>
                  </div>
                  {workflow.workflowDef?.name ? (
                    <p className="mt-1 text-xs text-[#475569]">Workflow: {workflow.workflowDef.name}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-[#64748b]">Started {formatDate(workflow.startedAt)}</p>
                  <div className="mt-2 space-y-2">
                    {workflow.tasks.map((task) => (
                      <div key={task.id} className="rounded-md bg-[#f8fafc] p-2 text-xs">
                        <p className="font-semibold text-[#0f172a]">Task {task.status}</p>
                        <p className="text-[#64748b]">Assigned to {task.assignedUser.email}</p>
                        <p className="text-[#64748b]">Due {formatDate(task.dueDate)}</p>
                        {task.comment ? <p className="text-[#334155]">{task.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {workflowHistory.length === 0 ? (
                <p className="text-sm text-[#64748b]">No workflow history on this document.</p>
              ) : null}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
