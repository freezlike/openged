-- OpenGED initial schema migration
CREATE TYPE auth_source AS ENUM ('LOCAL', 'OIDC', 'SAML');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');
CREATE TYPE document_status AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'PUBLISHED', 'ARCHIVED', 'DELETED');
CREATE TYPE version_type AS ENUM ('MAJOR', 'MINOR');
CREATE TYPE workflow_task_status AS ENUM ('OPEN', 'COMPLETED', 'REJECTED', 'CANCELED');
CREATE TYPE object_type AS ENUM ('SITE', 'LIBRARY', 'FOLDER', 'DOCUMENT');
CREATE TYPE principal_type AS ENUM ('USER', 'GROUP');
CREATE TYPE system_status AS ENUM ('NOT_INSTALLED', 'INSTALLED');
CREATE TYPE storage_provider AS ENUM ('LOCAL', 'S3');
CREATE TYPE field_data_type AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'LIST', 'TAXONOMY', 'USER_REFERENCE');
CREATE TYPE auth_mode AS ENUM ('LOCAL_ONLY', 'LOCAL_AND_SSO', 'SSO_ONLY');

CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT,
  "authSource" auth_source NOT NULL DEFAULT 'LOCAL',
  "externalId" TEXT UNIQUE,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  "mfaSecret" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLogin" TIMESTAMP(3)
);

CREATE TABLE "Group" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Role" (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE user_group (
  "userId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "groupId")
);

CREATE TABLE user_role (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE group_role (
  "groupId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("groupId", "roleId")
);

CREATE TABLE "Site" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  "ownerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Library" (
  id TEXT PRIMARY KEY,
  "siteId" TEXT NOT NULL,
  name TEXT NOT NULL,
  settings JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("siteId", name)
);

CREATE TABLE "Folder" (
  id TEXT PRIMARY KEY,
  "libraryId" TEXT NOT NULL,
  "parentId" TEXT,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("libraryId", path)
);

CREATE TABLE "ContentType" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Document" (
  id TEXT PRIMARY KEY,
  "libraryId" TEXT NOT NULL,
  "folderId" TEXT,
  title TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "currentVersionId" TEXT,
  "checkedOutById" TEXT,
  "checkedOutAt" TIMESTAMP(3),
  "contentTypeId" TEXT
);

CREATE TABLE "FileObject" (
  id TEXT PRIMARY KEY,
  "storageProvider" storage_provider NOT NULL,
  "objectKey" TEXT NOT NULL UNIQUE,
  size BIGINT NOT NULL,
  "mimeType" TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DocumentVersion" (
  id TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "versionMajor" INTEGER NOT NULL,
  "versionMinor" INTEGER NOT NULL,
  "versionType" version_type NOT NULL,
  "fileId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comment TEXT NOT NULL,
  "restoredFromId" TEXT,
  UNIQUE ("documentId", "versionMajor", "versionMinor")
);

CREATE TABLE "FieldDef" (
  id TEXT PRIMARY KEY,
  "libraryId" TEXT NOT NULL,
  name TEXT NOT NULL,
  "dataType" field_data_type NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  validation JSONB,
  "defaultValue" JSONB,
  "uniqueValues" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("libraryId", name)
);

CREATE TABLE "DocumentMetadata" (
  id TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "fieldId" TEXT NOT NULL,
  value JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("documentId", "fieldId")
);

CREATE TABLE "AclEntry" (
  id TEXT PRIMARY KEY,
  "objectType" object_type NOT NULL,
  "objectId" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "principalType" principal_type NOT NULL,
  "roleId" TEXT NOT NULL,
  inherited BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WorkflowTemplate" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  states JSONB NOT NULL,
  transitions JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "WorkflowInstance" (
  id TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  state TEXT NOT NULL,
  "startedBy" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3)
);

CREATE TABLE "WorkflowTask" (
  id TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  "assignedUserId" TEXT NOT NULL,
  status workflow_task_status NOT NULL DEFAULT 'OPEN',
  "dueDate" TIMESTAMP(3),
  comment TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);

CREATE TABLE "Session" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PasswordResetToken" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Taxonomy" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "TaxonomyValue" (
  id TEXT PRIMARY KEY,
  "taxonomyId" TEXT NOT NULL,
  label TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("taxonomyId", label)
);

CREATE TABLE "AuditLog" (
  id TEXT PRIMARY KEY,
  "actorId" TEXT,
  "eventType" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT,
  details JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SystemState" (
  id INTEGER PRIMARY KEY,
  status system_status NOT NULL DEFAULT 'NOT_INSTALLED',
  "installedAt" TIMESTAMP(3),
  "installedBy" TEXT,
  "appVersion" TEXT,
  "installerLocked" BOOLEAN NOT NULL DEFAULT false,
  "authMode" auth_mode NOT NULL DEFAULT 'LOCAL_ONLY',
  "searchEnabled" BOOLEAN NOT NULL DEFAULT false,
  "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "OrgSettings" (
  id INTEGER PRIMARY KEY,
  "orgName" TEXT NOT NULL,
  timezone TEXT NOT NULL,
  language TEXT NOT NULL,
  "technicalEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Site_ownerId_idx" ON "Site" ("ownerId");
CREATE INDEX "Library_siteId_idx" ON "Library" ("siteId");
CREATE INDEX "Folder_libraryId_idx" ON "Folder" ("libraryId");
CREATE INDEX "Folder_parentId_idx" ON "Folder" ("parentId");
CREATE INDEX "Document_libraryId_idx" ON "Document" ("libraryId");
CREATE INDEX "Document_folderId_idx" ON "Document" ("folderId");
CREATE INDEX "Document_status_idx" ON "Document" (status);
CREATE INDEX "Document_createdBy_idx" ON "Document" ("createdBy");
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion" ("documentId", "createdAt");
CREATE INDEX "FieldDef_libraryId_idx" ON "FieldDef" ("libraryId");
CREATE INDEX "DocumentMetadata_fieldId_idx" ON "DocumentMetadata" ("fieldId");
CREATE INDEX "AclEntry_objectType_objectId_idx" ON "AclEntry" ("objectType", "objectId");
CREATE INDEX "AclEntry_principalType_principalId_idx" ON "AclEntry" ("principalType", "principalId");
CREATE INDEX "AclEntry_roleId_idx" ON "AclEntry" ("roleId");
CREATE INDEX "WorkflowInstance_documentId_idx" ON "WorkflowInstance" ("documentId");
CREATE INDEX "WorkflowInstance_state_idx" ON "WorkflowInstance" (state);
CREATE INDEX "WorkflowTask_workflowId_idx" ON "WorkflowTask" ("workflowId");
CREATE INDEX "WorkflowTask_assignedUserId_idx" ON "WorkflowTask" ("assignedUserId");
CREATE INDEX "WorkflowTask_status_idx" ON "WorkflowTask" (status);
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog" ("eventType");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog" ("actorId");

ALTER TABLE user_group ADD CONSTRAINT "user_group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE user_group ADD CONSTRAINT "user_group_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE user_role ADD CONSTRAINT "user_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE user_role ADD CONSTRAINT "user_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE group_role ADD CONSTRAINT "group_role_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE group_role ADD CONSTRAINT "group_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Site" ADD CONSTRAINT "Site_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Library" ADD CONSTRAINT "Library_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_checkedOutById_fkey" FOREIGN KEY ("checkedOutById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "ContentType"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileObject"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_restoredFromId_fkey" FOREIGN KEY ("restoredFromId") REFERENCES "DocumentVersion"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldDef" ADD CONSTRAINT "FieldDef_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentMetadata" ADD CONSTRAINT "DocumentMetadata_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentMetadata" ADD CONSTRAINT "DocumentMetadata_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FieldDef"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AclEntry" ADD CONSTRAINT "AclEntry_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_startedBy_fkey" FOREIGN KEY ("startedBy") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxonomyValue" ADD CONSTRAINT "TaxonomyValue_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "Taxonomy"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
