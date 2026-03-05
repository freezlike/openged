import { Badge } from '../ui/badge';
import { DocumentStatus } from '../../types/domain';

const statusMap: Record<DocumentStatus, { label: string; variant: 'muted' | 'warning' | 'success' | 'danger' }> = {
  DRAFT: { label: 'Draft', variant: 'muted' },
  PENDING_VALIDATION: { label: 'Pending', variant: 'warning' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  ARCHIVED: { label: 'Archived', variant: 'muted' },
  DELETED: { label: 'Deleted', variant: 'danger' },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const mapped = statusMap[status] ?? statusMap.DRAFT;
  return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
}
