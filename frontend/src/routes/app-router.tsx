import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../components/protected-route';
import { AppShell } from '../components/layout/app-shell';
import { AuditPage } from '../pages/audit-page';
import { DocumentPreviewPage } from '../pages/document-preview-page';
import { FavoritesPage } from '../pages/favorites-page';
import { InstallPage } from '../pages/install-page';
import { LoginPage } from '../pages/login-page';
import { RecentPage } from '../pages/recent-page';
import { UsersPage } from '../pages/admin/users-page';
import { WorkflowDesignerPage } from '../pages/admin/workflow-designer-page';
import { TasksPage } from '../pages/tasks-page';
import { LibraryPage } from '../pages/sites/library-page';
import { SitesPage } from '../pages/sites/sites-page';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/install" element={<InstallPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/sites" replace />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/sites/:siteId/libraries/:libraryId" element={<LibraryPage />} />
          <Route path="/sites/:siteId/libraries/:libraryId/folders/:folderId" element={<LibraryPage />} />
          <Route path="/documents/:documentId/preview" element={<DocumentPreviewPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/recent" element={<RecentPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/workflows/designer" element={<WorkflowDesignerPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
