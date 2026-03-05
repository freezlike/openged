import { useEffect, useState } from 'react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { formatDate } from '../../lib/utils';
import { MyTask } from '../../types/domain';

interface TaskPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MyTask | null;
  onDecision: (decision: 'COMPLETED' | 'REJECTED', comment?: string) => Promise<void>;
}

export function TaskPanel({ open, onOpenChange, task, onDecision }: TaskPanelProps) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setComment('');
  }, [task?.id]);

  if (!task) {
    return null;
  }

  const decide = async (decision: 'COMPLETED' | 'REJECTED') => {
    setSaving(true);

    try {
      await onDecision(decision, comment || undefined);
      setComment('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg space-y-4">
        <SheetHeader>
          <SheetTitle>Task review</SheetTitle>
          <SheetDescription>Approve or reject this validation request.</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3">
          <p className="text-sm font-semibold text-[#0f172a]">{task.document.title}</p>
          <p className="text-xs text-[#64748b]">
            {task.document.site.name} / {task.document.library.name}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="warning">{task.workflow.state}</Badge>
            <Badge variant={task.status === 'OPEN' ? 'warning' : 'muted'}>{task.status}</Badge>
          </div>
          <p className="text-xs text-[#475569]">Due: {formatDate(task.dueDate)}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Comment</label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[#d6dee8] px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/35"
            placeholder="Decision notes"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button disabled={saving || task.status !== 'OPEN'} onClick={() => decide('COMPLETED')}>
            Approve
          </Button>
          <Button
            variant="danger"
            disabled={saving || task.status !== 'OPEN'}
            onClick={() => decide('REJECTED')}
          >
            Reject
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
