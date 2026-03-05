# OpenGED

OpenGED is a production-oriented GED/DMS built from scratch with:
- Backend: NestJS + Prisma + PostgreSQL
- Frontend: React + TypeScript + Vite + Tailwind + Radix + TanStack Query/Table/Virtual
- Storage: S3-compatible (MinIO) with local fallback
- Optional search profile: OpenSearch
- Deployment: Docker Compose (primary mode)

## Architecture

```text
frontend (React)
   |
   v
backend API (NestJS)
   |
   +-- PostgreSQL
   +-- Object storage (MinIO / S3)
   +-- Optional OpenSearch
```

## What Is Implemented

### Core GED
- Sites / Libraries / Folders hierarchy
- Upload, metadata update, download
- Versioning (major/minor), check-in/check-out, version history
- Document status lifecycle (`DRAFT`, `PENDING_VALIDATION`, `PUBLISHED`, `ARCHIVED`, `DELETED`)

### Security & Identity
- Local auth (JWT access + refresh), password reset endpoints
- Auth modes: `LOCAL_ONLY`, `LOCAL_AND_SSO`, `SSO_ONLY`
- SSO scaffolding endpoints (OIDC/SAML assertion entry)
- RBAC + ACL checks across Site/Library/Folder/Document

### Installer
- `/install` wizard backend + frontend flow
- System checks, org setup, admin creation, feature toggles
- Initial GED bootstrap and installer lock

### Workflow
- Start workflow from document context
- Task assignment and completion (approve/reject)
- Document workflow history
- “My tasks” page with filters/presets

### Audit
- Audit logging service
- Audit listing and export (`json` / `csv`)

### Modern SharePoint-like UI
- App shell with collapsible site/library nav
- Library command bar (New, Upload, Edit metadata, Download, Versions, Automate, Delete)
- Details view table with:
  - Multi-select + checkboxes
  - Context menu
  - Column resize / show-hide / order persistence (localStorage)
  - Virtualized rows for large lists
- Right details pane tabs: Details / Activity / Versions / Workflow
- Workflow start side panel
- Document preview route with metadata/details pane

## Main Routes

- `/install`
- `/login`
- `/sites`
- `/sites/:siteId/libraries/:libraryId`
- `/sites/:siteId/libraries/:libraryId/folders/:folderId`
- `/documents/:documentId/preview`
- `/tasks`
- `/recent`
- `/favorites`
- `/audit`

## API Highlights

### Existing core endpoints
- `POST /api/documents/upload`
- `GET /api/documents/:id/download`
- `PUT /api/documents/:id/metadata`
- `POST /api/documents/:id/checkout`
- `POST /api/documents/:id/checkin`
- `POST /api/documents/bulk-delete`
- `GET /api/documents/:id/versions`
- `GET /api/search`
- `POST /api/workflow/start`
- `POST /api/tasks/:id/complete`
- `GET /api/admin/audit`

### Added for modern library/workflow UX
- `GET /api/dms/libraries/:libraryId/items`
- `GET /api/documents/:id`
- `GET /api/documents/:id/activity`
- `GET /api/documents/:id/workflows/history`
- `GET /api/workflows/available`
- `GET /api/tasks/my`

## Quick Start (Docker Compose)

```bash
docker compose up -d --build
```

Open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
- MinIO Console: `http://localhost:9001`

### Optional OpenSearch profile

```bash
docker compose --profile search up -d
```

## Demo Accounts (seeded)

Password for all:
- `ChangeMe123!`

Users:
- `admin@example.com` (super/global admin)
- `editor@example.com`
- `validator@example.com`
- `reader@example.com`

The Docker seed finalizes installation automatically (`installed=true`) so you can test UI/API immediately.
Installer APIs and `/install` UI are still present but locked after seed finalization.

## Seeded Demo Data

- Site: `General`
- Library: `Documents`
- Folders: `HR`, `Finance`, `Quality`, `IT`
- Content types: `Document`, `Procedure`, `Contract`, `Invoice`
- Taxonomies/metadata fields: `Confidentiality`, `Domain`
- Sample documents + one active validation task

## Useful Operations

Rebuild services:
```bash
docker compose up -d --build backend frontend
```

View backend logs:
```bash
docker compose logs -f backend
```

Reset to clean demo state (destructive):
```bash
docker compose down -v
docker compose up -d --build
```

Run smoke tests against running stack:
```bash
npm run smoke:api
npm run smoke:web
```

Run frontend unit tests:
```bash
npm run test:frontend
```

## Local Development (without Docker)

Prerequisites:
- Node.js 22+
- PostgreSQL 16+
- Optional MinIO

```bash
npm --workspace backend install
npm --workspace frontend install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

cd backend
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev

# in another shell
cd frontend
npm run dev
```

## Production Notes

Before production:
- Set strong secrets (`JWT_SECRET`, `MASTER_ENCRYPTION_KEY`)
- Enforce HTTPS via reverse proxy/load balancer
- Configure backup/retention for PostgreSQL + object storage
- Configure SMTP and complete full OIDC/SAML provider flows
- Add centralized observability (metrics/log aggregation)

## CI

GitHub Actions workflow is included at `.github/workflows/ci.yml` and runs:
- backend lint + workspace build
- frontend unit tests (Vitest)
- full `docker compose up -d --build`
- API smoke tests (`scripts/smoke-api.mjs`)
- web smoke tests (`scripts/smoke-web.mjs`)
