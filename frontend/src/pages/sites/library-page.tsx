import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Filter, FolderPlus, Search } from 'lucide-react';

import { createFolder, getLibraryItems } from '../../api/dms';
import {
  checkinDocument,
  deleteDocuments,
  downloadDocument,
  getDocumentActivity,
  getDocumentDetails,
  getDocumentWorkflowHistory,
  listVersions,
  updateDocumentMetadata,
  uploadDocument,
} from '../../api/documents';
import { listAvailableWorkflows, startWorkflow } from '../../api/workflow';
import { CommandBar } from '../../components/library/command-bar';
import { DetailsPane } from '../../components/library/details-pane';
import { DocumentTable, LibraryRowItem } from '../../components/library/document-table';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { WorkflowStartPanel } from '../../components/workflow/workflow-start-panel';
import { useAuth } from '../../features/auth/auth-context';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { formatDate } from '../../lib/utils';
import { LibraryDocumentItem } from '../../types/domain';

const savedViews = [
  { key: 'all', label: 'All documents' },
  { key: 'mine', label: 'My documents' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'pending', label: 'Pending approval' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
] as const;

export function LibraryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { siteId, libraryId, folderId } = useParams<{
    siteId: string;
    libraryId: string;
    folderId?: string;
  }>();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [selectedRows, setSelectedRows] = useState<LibraryRowItem[]>([]);
  const [viewKey, setViewKey] = useState<(typeof savedViews)[number]['key']>('all');

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('ALL');
  const [confidentialityFilter, setConfidentialityFilter] = useState<string>('ALL');
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [modifiedFrom, setModifiedFrom] = useState<string>('');
  const [modifiedTo, setModifiedTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'title'>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [workflowPanelOpen, setWorkflowPanelOpen] = useState(false);
  const [selectionResetToken, setSelectionResetToken] = useState(0);

  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const debouncedAuthor = useDebouncedValue(authorFilter, 250);

  const computedStatus = useMemo(() => {
    if (viewKey === 'drafts') {
      return 'DRAFT';
    }

    if (viewKey === 'pending') {
      return 'PENDING_VALIDATION';
    }

    if (viewKey === 'published') {
      return 'PUBLISHED';
    }

    if (viewKey === 'archived') {
      return 'ARCHIVED';
    }

    if (statusFilter !== 'ALL') {
      return statusFilter;
    }

    return undefined;
  }, [statusFilter, viewKey]);

  const libraryItemsQuery = useQuery({
    queryKey: [
      'library-items',
      libraryId,
      folderId,
      debouncedSearch,
      viewKey,
      statusFilter,
      contentTypeFilter,
      confidentialityFilter,
      debouncedAuthor,
      modifiedFrom,
      modifiedTo,
      sortBy,
      sortDir,
      user?.id,
    ],
    enabled: Boolean(libraryId),
    queryFn: () =>
      getLibraryItems({
        libraryId: libraryId!,
        folderId,
        q: debouncedSearch || undefined,
        status: computedStatus,
        contentType: contentTypeFilter !== 'ALL' ? contentTypeFilter : undefined,
        confidentiality: confidentialityFilter !== 'ALL' ? confidentialityFilter : undefined,
        ownerId: viewKey === 'mine' ? user?.id : undefined,
        author: debouncedAuthor || undefined,
        modifiedFrom: modifiedFrom || undefined,
        modifiedTo: modifiedTo || undefined,
        sortBy,
        sortDir,
        pageSize: 200,
      }),
  });

  const rows = useMemo<LibraryRowItem[]>(() => {
    if (!libraryItemsQuery.data) {
      return [];
    }

    const folders = libraryItemsQuery.data.folders.map((folder) => ({
      ...folder,
      title: folder.name,
      kind: 'folder' as const,
    }));

    return [...folders, ...libraryItemsQuery.data.documents];
  }, [libraryItemsQuery.data]);

  const selectedDocument = selectedRows.find((item) => item.kind === 'document') as
    | LibraryDocumentItem
    | undefined;

  const documentDetailsQuery = useQuery({
    queryKey: ['document-details', selectedDocument?.id],
    enabled: Boolean(selectedDocument?.id),
    queryFn: () => getDocumentDetails(selectedDocument!.id),
  });

  const versionsQuery = useQuery({
    queryKey: ['document-versions', selectedDocument?.id],
    enabled: Boolean(selectedDocument?.id),
    queryFn: () => listVersions(selectedDocument!.id),
  });

  const activityQuery = useQuery({
    queryKey: ['document-activity', selectedDocument?.id],
    enabled: Boolean(selectedDocument?.id),
    queryFn: () => getDocumentActivity(selectedDocument!.id),
  });

  const workflowHistoryQuery = useQuery({
    queryKey: ['document-workflow-history', selectedDocument?.id],
    enabled: Boolean(selectedDocument?.id),
    queryFn: () => getDocumentWorkflowHistory(selectedDocument!.id),
  });

  const availableWorkflowsQuery = useQuery({
    queryKey: ['workflows-available', libraryId],
    enabled: Boolean(libraryId),
    queryFn: () => listAvailableWorkflows({ libraryId }),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items', libraryId] });
    },
  });

  const metadataMutation = useMutation({
    mutationFn: (fields: Array<{ fieldId: string; value: unknown }>) =>
      updateDocumentMetadata(selectedDocument!.id, fields),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['document-details', selectedDocument?.id] });
      await queryClient.invalidateQueries({ queryKey: ['library-items', libraryId] });
    },
  });

  const startWorkflowMutation = useMutation({
    mutationFn: startWorkflow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['library-items', libraryId] });
      await queryClient.invalidateQueries({ queryKey: ['document-workflow-history', selectedDocument?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocuments,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['library-items', libraryId] });
      setSelectedRows([]);
      setSelectionResetToken((current) => current + 1);
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(libraryId!, { name, parentId: folderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-items', libraryId] });
    },
  });

  const onUploadSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !libraryId) {
      return;
    }

    await uploadMutation.mutateAsync({
      file,
      libraryId,
      folderId,
      title: file.name,
      comment: 'Upload from modern command bar',
    });

    event.target.value = '';
  };

  const onDownload = async (item?: LibraryRowItem) => {
    const target = item ?? selectedDocument;

    if (!target || target.kind !== 'document') {
      return;
    }

    const blob = await downloadDocument(target.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = target.title;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onCheckin = async () => {
    if (!selectedDocument) {
      return;
    }

    const picker = document.createElement('input');
    picker.type = 'file';
    picker.onchange = async () => {
      const file = picker.files?.[0];
      if (!file) {
        return;
      }

      await checkinDocument({
        documentId: selectedDocument.id,
        file,
        comment: 'Check-in from command bar',
        versionType: 'minor',
      });

      await queryClient.invalidateQueries({ queryKey: ['document-versions', selectedDocument.id] });
      await queryClient.invalidateQueries({ queryKey: ['library-items', libraryId] });
    };

    picker.click();
  };

  const onOpenFolder = (nextFolderId: string) => {
    if (!siteId || !libraryId) {
      return;
    }

    navigate(`/sites/${siteId}/libraries/${libraryId}/folders/${nextFolderId}`);
  };

  const selectedCount = selectedRows.length;

  const context = libraryItemsQuery.data?.context;

  return (
    <Card className="flex min-h-[calc(100vh-7.5rem)] flex-col overflow-hidden xl:h-[calc(100vh-7.5rem)] xl:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <Link to="/sites" className="hover:text-[#1d4ed8]">
              Sites
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{context?.site.name ?? 'Site'}</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{context?.library.name ?? 'Library'}</span>
            {context?.folder ? (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{context.folder.name}</span>
              </>
            ) : null}
          </div>
          <h1 className="mt-1 text-lg font-semibold text-[#0f172a]">{context?.library.name ?? 'Library'}</h1>
          <p className="text-xs text-[#64748b]">Last refreshed {formatDate(new Date())}</p>
        </div>

        <CommandBar
          selectedCount={selectedCount}
          onNewFolder={() => {
            const name = window.prompt('Folder name');
            if (!name) {
              return;
            }
            createFolderMutation.mutate(name);
          }}
          onUpload={() => fileInputRef.current?.click()}
          onEditMetadata={() => {
            if (!selectedDocument) {
              return;
            }
            void documentDetailsQuery.refetch();
          }}
          onDownload={() => void onDownload()}
          onVersions={() => {
            if (selectedDocument) {
              void versionsQuery.refetch();
            }
          }}
          onStartWorkflow={() => setWorkflowPanelOpen(true)}
          onDelete={() => {
            const documents = selectedRows.filter((item) => item.kind === 'document');
            const hasFolders = selectedRows.some((item) => item.kind === 'folder');

            if (documents.length === 0) {
              window.alert('Select at least one document to delete.');
              return;
            }

            if (hasFolders) {
              window.alert('Folder deletion is not available yet. Only selected documents will be deleted.');
            }

            const confirmed = window.confirm(`Delete ${documents.length} document(s)?`);
            if (!confirmed) {
              return;
            }

            void deleteMutation.mutateAsync(documents.map((item) => item.id));
          }}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e8f0] bg-white px-3 py-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-[#94a3b8]" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search in this library"
              className="pl-8"
            />
          </div>

          <Select value={viewKey} onValueChange={(value) => setViewKey(value as typeof viewKey)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {savedViews.map((view) => (
                <SelectItem key={view.key} value={view.key}>
                  {view.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <Filter className="mr-1 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PENDING_VALIDATION">Pending</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="Document">Document</SelectItem>
              <SelectItem value="Procedure">Procedure</SelectItem>
              <SelectItem value="Contract">Contract</SelectItem>
              <SelectItem value="Invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>

          <Select value={confidentialityFilter} onValueChange={setConfidentialityFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Confidentiality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All classifications</SelectItem>
              <SelectItem value="Public">Public</SelectItem>
              <SelectItem value="Internal">Internal</SelectItem>
              <SelectItem value="Restricted">Restricted</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={authorFilter}
            onChange={(event) => setAuthorFilter(event.target.value)}
            placeholder="Author"
            className="w-40"
          />

          <Input
            type="date"
            value={modifiedFrom}
            onChange={(event) => setModifiedFrom(event.target.value)}
            className="w-40"
            title="Modified from"
          />

          <Input
            type="date"
            value={modifiedTo}
            onChange={(event) => setModifiedTo(event.target.value)}
            className="w-40"
            title="Modified to"
          />

          <Select
            value={`${sortBy}:${sortDir}`}
            onValueChange={(value) => {
              const [nextBy, nextDir] = value.split(':');
              setSortBy(nextBy as 'updatedAt' | 'createdAt' | 'title');
              setSortDir(nextDir as 'asc' | 'desc');
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt:desc">Modified (newest)</SelectItem>
              <SelectItem value="updatedAt:asc">Modified (oldest)</SelectItem>
              <SelectItem value="createdAt:desc">Created (newest)</SelectItem>
              <SelectItem value="createdAt:asc">Created (oldest)</SelectItem>
              <SelectItem value="title:asc">Name (A-Z)</SelectItem>
              <SelectItem value="title:desc">Name (Z-A)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="secondary" size="sm" onClick={onCheckin} disabled={!selectedDocument}>
            Check-in
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (selectedDocument) {
                navigate(`/documents/${selectedDocument.id}/preview`);
              }
            }}
            disabled={!selectedDocument}
          >
            Preview
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (selectedDocument) {
                setWorkflowPanelOpen(true);
              }
            }}
            disabled={!selectedDocument}
          >
            Automate
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const name = window.prompt('New folder name');
              if (name) {
                createFolderMutation.mutate(name);
              }
            }}
          >
            <FolderPlus className="mr-1 h-4 w-4" />
            Folder
          </Button>
        </div>

        <input ref={fileInputRef} type="file" className="hidden" onChange={onUploadSelected} />

        <DocumentTable
          rows={rows}
          loading={libraryItemsQuery.isLoading}
          viewKey={`${siteId}-${libraryId}`}
          resetSelectionToken={selectionResetToken}
          onSelectionChange={setSelectedRows}
          onOpenPreview={(item) => {
            if (item.kind === 'document') {
              navigate(`/documents/${item.id}/preview`);
            }
          }}
          onOpenVersions={(item) => {
            if (item.kind === 'document') {
              queryClient.invalidateQueries({ queryKey: ['document-versions', item.id] });
            }
          }}
          onStartWorkflow={(item) => {
            if (item.kind === 'document') {
              setSelectedRows([item]);
              setWorkflowPanelOpen(true);
            }
          }}
          onDownload={(item) => {
            void onDownload(item);
          }}
          onOpenFolder={onOpenFolder}
        />
      </div>

      <div className="w-full shrink-0 xl:w-[420px]">
        <DetailsPane
          document={documentDetailsQuery.data ?? null}
          activity={activityQuery.data ?? []}
          versions={versionsQuery.data ?? []}
          workflowHistory={workflowHistoryQuery.data ?? []}
          onUpdateMetadata={async (fields) => {
            await metadataMutation.mutateAsync(fields);
          }}
          onStartWorkflow={() => setWorkflowPanelOpen(true)}
        />
      </div>

      <WorkflowStartPanel
        open={workflowPanelOpen}
        onOpenChange={setWorkflowPanelOpen}
        documentId={selectedDocument?.id}
        documentTitle={selectedDocument?.title}
        workflows={availableWorkflowsQuery.data ?? []}
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
