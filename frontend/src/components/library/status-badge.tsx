import { useTranslation } from 'react-i18next';

import { Badge } from '../ui/badge';
import { DocumentStatus } from '../../types/domain';

const statusMap: Record<DocumentStatus, { key: string; variant: 'muted' | 'warning' | 'success' | 'danger' }> = {
  DRAFT: { key: 'status.draft', variant: 'muted' },
  PENDING_VALIDATION: { key: 'status.pending', variant: 'warning' },
  PUBLISHED: { key: 'status.published', variant: 'success' },
  ARCHIVED: { key: 'status.archived', variant: 'muted' },
  DELETED: { key: 'status.deleted', variant: 'danger' },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation('common');
  const mapped = statusMap[status] ?? statusMap.DRAFT;
  return <Badge variant={mapped.variant}>{t(mapped.key)}</Badge>;
}
