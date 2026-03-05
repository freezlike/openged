export type DocumentStatus =
  | 'DRAFT'
  | 'PENDING_VALIDATION'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'DELETED';

export interface SiteSummary {
  id: string;
  name: string;
  description?: string;
  libraries: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
}

export interface LibraryContext {
  site: { id: string; name: string };
  library: { id: string; name: string };
  folder: { id: string; name: string; parentId?: string | null; path: string } | null;
}

export interface LibraryFolderItem {
  kind: 'folder';
  id: string;
  name: string;
  parentId?: string | null;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryDocumentItem {
  kind: 'document';
  id: string;
  title: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; email: string };
  modifiedBy: { id: string; email: string };
  contentType: string;
  confidentiality?: string | null;
  folderId?: string | null;
  currentVersion?: string | null;
}

export interface LibraryItemsResponse {
  context: LibraryContext;
  folders: LibraryFolderItem[];
  documents: LibraryDocumentItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface DocumentDetails {
  id: string;
  title: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; email: string };
  site: { id: string; name: string };
  library: { id: string; name: string };
  folder: { id: string; name: string; path: string } | null;
  contentType: string;
  currentVersion:
    | {
        id: string;
        version: string;
        comment: string;
        mimeType: string;
        size: string;
        modifiedBy: { id: string; email: string };
      }
    | null;
  metadata: Array<{
    id: string;
    fieldId: string;
    fieldName: string;
    value: unknown;
    required: boolean;
    type: string;
    updatedAt: string;
  }>;
  availableFields: Array<{
    id: string;
    name: string;
    dataType: string;
    required: boolean;
    validation?: Record<string, unknown>;
    defaultValue?: unknown;
  }>;
}

export interface AuditEvent {
  id: string;
  actor?: { id: string; email: string } | null;
  eventType: string;
  objectType: string;
  objectId?: string | null;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowHistoryItem {
  id: string;
  state: string;
  workflowDef?: { id: string; name: string } | null;
  startedAt: string;
  endedAt?: string | null;
  startedBy: { id: string; email: string };
  tasks: Array<{
    id: string;
    status: string;
    assignedUser: { id: string; email: string };
    dueDate?: string | null;
    comment?: string | null;
    createdAt: string;
    completedAt?: string | null;
  }>;
}

export interface WorkflowGraphNode {
  id: string;
  type: string;
  label?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface WorkflowGraphEdge {
  id?: string;
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  action?: string;
  conditions?: Record<string, unknown> | null;
}

export interface WorkflowDefinitionJson {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
}

export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  description?: string | null;
  definitionJson?: WorkflowDefinitionJson;
  states?: unknown;
  transitions?: unknown;
}

export interface MyTask {
  id: string;
  status: 'OPEN' | 'COMPLETED' | 'REJECTED' | 'CANCELED';
  dueDate?: string | null;
  comment?: string | null;
  createdAt: string;
  completedAt?: string | null;
  workflow: {
    id: string;
    state: string;
  };
  document: {
    id: string;
    title: string;
    status: DocumentStatus;
    site: { id: string; name: string };
    library: { id: string; name: string };
    contentType: string;
  };
}
