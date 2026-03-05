import { useEffect, useState } from 'react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { WorkflowTemplateSummary } from '../../types/domain';

interface WorkflowStartPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId?: string;
  documentTitle?: string;
  workflows: WorkflowTemplateSummary[];
  onSubmit: (payload: {
    documentId: string;
    templateName?: string;
    assignedUserId?: string;
    dueDate?: string;
    comment?: string;
    versionImpact?: 'minor' | 'major';
  }) => Promise<void>;
}

export function WorkflowStartPanel({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  workflows,
  onSubmit,
}: WorkflowStartPanelProps) {
  const [workflowName, setWorkflowName] = useState<string>('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [versionImpact, setVersionImpact] = useState<'minor' | 'major'>('minor');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workflows.length > 0 && !workflowName) {
      setWorkflowName(workflows[0].name);
    }
  }, [workflows, workflowName]);

  const submit = async () => {
    if (!documentId) {
      return;
    }

    setSaving(true);

    try {
      await onSubmit({
        documentId,
        templateName: workflowName || undefined,
        assignedUserId: assignedUserId || undefined,
        dueDate: dueDate || undefined,
        comment: comment || undefined,
        versionImpact,
      });

      onOpenChange(false);
      setAssignedUserId('');
      setDueDate('');
      setComment('');
      setVersionImpact('minor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg space-y-4">
        <SheetHeader>
          <SheetTitle>Start workflow</SheetTitle>
          <SheetDescription>
            Launch approval flow for {documentTitle ? `"${documentTitle}"` : 'selected document'}.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Workflow</label>
            <Select value={workflowName} onValueChange={setWorkflowName}>
              <SelectTrigger>
                <SelectValue placeholder="Select workflow" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.name}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Assignee user ID</label>
            <Input
              value={assignedUserId}
              onChange={(event) => setAssignedUserId(event.target.value)}
              placeholder="Optional assignee"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Due date</label>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Version impact</label>
            <Select value={versionImpact} onValueChange={(value) => setVersionImpact(value as 'minor' | 'major')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">Minor version</SelectItem>
                <SelectItem value="major">Major version</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Comment</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[#d6dee8] px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/35"
              placeholder="Workflow request notes"
            />
          </div>
        </div>

        <Button disabled={!documentId || saving} onClick={submit} className="w-full">
          {saving ? 'Starting...' : 'Start workflow'}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
