import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileClock, Play, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  downloadDocument,
  getDocumentActivity,
  getDocumentDetails,
  getDocumentWorkflowHistory,
  listVersions,
  updateDocumentMetadata,
} from '../api/documents';
import { listAvailableWorkflows, startWorkflow } from '../api/workflow';
import { DetailsPane } from '../components/library/details-pane';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { WorkflowStartPanel } from '../components/workflow/workflow-start-panel';

export function DocumentPreviewPage() {
  const { t } = useTranslation(['document']);
  const { documentId } = useParams<{ documentId: string }>();
  const queryClient = useQueryClient();

  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const detailsQuery = useQuery({
    queryKey: ['preview-document-details', documentId],
    enabled: Boolean(documentId),
    queryFn: () => getDocumentDetails(documentId!),
  });

  const versionsQuery = useQuery({
    queryKey: ['preview-document-versions', documentId],
    enabled: Boolean(documentId),
    queryFn: () => listVersions(documentId!),
  });

  const activityQuery = useQuery({
    queryKey: ['preview-document-activity', documentId],
    enabled: Boolean(documentId),
    queryFn: () => getDocumentActivity(documentId!),
  });

  const workflowHistoryQuery = useQuery({
    queryKey: ['preview-document-workflow-history', documentId],
    enabled: Boolean(documentId),
    queryFn: () => getDocumentWorkflowHistory(documentId!),
  });

  const workflowsQuery = useQuery({
    queryKey: ['preview-workflows-available', detailsQuery.data?.library.id],
    enabled: Boolean(detailsQuery.data?.library.id),
    queryFn: () => listAvailableWorkflows({ libraryId: detailsQuery.data?.library.id }),
  });

  const metadataMutation = useMutation({
    mutationFn: (fields: Array<{ fieldId: string; value: unknown }>) =>
      updateDocumentMetadata(documentId!, fields),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['preview-document-details', documentId] });
    },
  });

  const startWorkflowMutation = useMutation({
    mutationFn: startWorkflow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['preview-document-workflow-history', documentId] });
      await queryClient.invalidateQueries({ queryKey: ['preview-document-details', documentId] });
    },
  });

  useEffect(() => {
    let disposed = false;
    let currentUrl: string | null = null;

    const loadPreview = async () => {
      if (!documentId) {
        return;
      }

      try {
        setPreviewError(null);
        const blob = await downloadDocument(documentId);

        if (disposed) {
          return;
        }

        const mimeType = detailsQuery.data?.currentVersion?.mimeType ?? blob.type;

        if (mimeType.includes('text')) {
          const text = await blob.text();
          if (!disposed) {
            setTextPreview(text.slice(0, 20_000));
          }
          return;
        }

        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch {
        setPreviewError(t('preview.unavailable'));
      }
    };

    void loadPreview();

    return () => {
      disposed = true;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [documentId, detailsQuery.data?.currentVersion?.mimeType, t]);

  const previewMimeType = detailsQuery.data?.currentVersion?.mimeType ?? '';

  const previewNode = useMemo(() => {
    if (previewError) {
      return <p className="text-sm text-[#64748b]">{previewError}</p>;
    }

    if (textPreview) {
      return <pre className="max-h-[70vh] overflow-auto rounded-lg bg-[#0f172a] p-4 text-xs text-white">{textPreview}</pre>;
    }

    if (blobUrl && previewMimeType.includes('pdf')) {
      return <iframe src={blobUrl} title={t('preview.iframeTitle')} className="h-[70vh] w-full rounded-lg border" />;
    }

    if (blobUrl && previewMimeType.includes('image')) {
      return <img src={blobUrl} alt={t('preview.imageAlt')} className="max-h-[70vh] w-full rounded-lg object-contain" />;
    }

    return <p className="text-sm text-[#64748b]">{t('preview.loading')}</p>;
  }, [blobUrl, previewError, previewMimeType, t, textPreview]);

  if (!documentId) {
    return <p className="text-sm text-[#64748b]">{t('preview.notFound')}</p>;
  }

  return (
    <Card className="flex min-h-[calc(100vh-7.5rem)] flex-col overflow-hidden xl:h-[calc(100vh-7.5rem)] xl:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] bg-white px-3 py-2">
          <Button variant="secondary" size="sm" onClick={() => setWorkflowOpen(true)}>
            <Play className="h-4 w-4" />
            {t('preview.startWorkflow')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void metadataMutation.reset()}>
            <Pencil className="h-4 w-4" />
            {t('preview.editMetadata')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!detailsQuery.data) {
                return;
              }
              void queryClient.invalidateQueries({ queryKey: ['preview-document-versions', documentId] });
            }}
          >
            <FileClock className="h-4 w-4" />
            {t('preview.versions')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const blob = await downloadDocument(documentId);
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = detailsQuery.data?.title ?? 'document';
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
            {t('preview.download')}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">{previewNode}</div>
      </div>

      <div className="w-full shrink-0 xl:w-[420px]">
        <DetailsPane
          document={detailsQuery.data ?? null}
          activity={activityQuery.data ?? []}
          versions={versionsQuery.data ?? []}
          workflowHistory={workflowHistoryQuery.data ?? []}
          onUpdateMetadata={async (fields) => {
            await metadataMutation.mutateAsync(fields);
          }}
          onStartWorkflow={() => setWorkflowOpen(true)}
        />
      </div>

      <WorkflowStartPanel
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        documentId={documentId}
        documentTitle={detailsQuery.data?.title}
        workflows={workflowsQuery.data ?? []}
        onSubmit={async (payload) => {
          await startWorkflowMutation.mutateAsync({
            documentId: payload.documentId,
            dueDate: payload.dueDate,
            assignedUserId: payload.assignedUserId,
            workflowDefId: payload.workflowDefId,
            templateName: payload.templateName,
          });
        }}
      />
    </Card>
  );
}
