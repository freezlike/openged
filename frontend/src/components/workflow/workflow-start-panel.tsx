import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LookupItem } from '../../api/lookup';
import { SmartUserPicker } from '../smart';
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
    workflowDefId?: string;
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
  const { t } = useTranslation('workflow');
  const [workflowDefId, setWorkflowDefId] = useState<string>('');
  const [assignee, setAssignee] = useState<LookupItem | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [versionImpact, setVersionImpact] = useState<'minor' | 'major'>('minor');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workflows.length > 0 && (!workflowDefId || !workflows.some((workflow) => workflow.id === workflowDefId))) {
      setWorkflowDefId(workflows[0].id);
    }
  }, [workflowDefId, workflows]);

  const selectedWorkflow = workflows.find((workflow) => workflow.id === workflowDefId);

  const submit = async () => {
    if (!documentId) {
      return;
    }

    setSaving(true);

    try {
      await onSubmit({
        documentId,
        workflowDefId: selectedWorkflow?.definitionJson ? workflowDefId || undefined : undefined,
        templateName: selectedWorkflow?.name || undefined,
        assignedUserId: assignee?.id || undefined,
        dueDate: dueDate || undefined,
        comment: comment || undefined,
        versionImpact,
      });

      onOpenChange(false);
      setAssignee(null);
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
          <SheetTitle>{t('panel.startTitle')}</SheetTitle>
          <SheetDescription>
            {t('panel.startDescription', {
              title: documentTitle ? `"${documentTitle}"` : t('panel.selectedDocument'),
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('panel.workflow')}</label>
            <Select value={workflowDefId} onValueChange={setWorkflowDefId}>
              <SelectTrigger>
                <SelectValue placeholder={t('panel.selectWorkflow')} />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedWorkflow?.description ? (
              <p className="text-xs text-[#64748b]">{selectedWorkflow.description}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('panel.assignee')}</label>
            <SmartUserPicker
              value={assignee}
              onChange={setAssignee}
              placeholder={t('panel.searchUser')}
              activeOnly
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('panel.dueDate')}</label>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('panel.versionImpact')}</label>
            <Select value={versionImpact} onValueChange={(value) => setVersionImpact(value as 'minor' | 'major')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">{t('panel.minor')}</SelectItem>
                <SelectItem value="major">{t('panel.major')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{t('panel.comment')}</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-[#d6dee8] px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]/35"
              placeholder={t('panel.requestNotes')}
            />
          </div>
        </div>

        <Button disabled={!documentId || saving} onClick={submit} className="w-full">
          {saving ? t('panel.starting') : t('panel.start')}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
