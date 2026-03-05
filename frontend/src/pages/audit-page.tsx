import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getAudit } from '../api/admin';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { formatDate } from '../lib/utils';

export function AuditPage() {
  const { t } = useTranslation(['audit', 'common']);
  const [eventType, setEventType] = useState('');
  const [submittedFilter, setSubmittedFilter] = useState('');

  const auditQuery = useQuery({
    queryKey: ['audit', submittedFilter],
    queryFn: () => getAudit(submittedFilter ? { eventType: submittedFilter } : {}),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedFilter(eventType);
  };

  return (
    <Card className="flex h-[calc(100vh-7.5rem)] flex-col overflow-hidden">
      <div className="border-b border-[#e2e8f0] px-4 py-3">
        <h1 className="text-lg font-semibold text-[#0f172a]">{t('title')}</h1>
        <p className="text-sm text-[#64748b]">{t('description')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-b border-[#e2e8f0] bg-white px-3 py-2">
        <Input
          placeholder={t('filterPlaceholder')}
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
          className="max-w-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          {t('common:actions.apply')}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-[#e2e8f0] text-xs uppercase tracking-wide text-[#64748b]">
              <th className="px-3 py-2">{t('event')}</th>
              <th className="px-3 py-2">{t('object')}</th>
              <th className="px-3 py-2">{t('actor')}</th>
              <th className="px-3 py-2">{t('time')}</th>
            </tr>
          </thead>
          <tbody>
            {auditQuery.data?.map((item) => (
              <tr key={item.id} className="border-b border-[#f1f5f9]">
                <td className="px-3 py-2 font-medium text-[#0f172a]">{item.eventType}</td>
                <td className="px-3 py-2 text-xs text-[#334155]">{item.objectType}</td>
                <td className="px-3 py-2 text-xs text-[#334155]">{item.actor?.email ?? t('system')}</td>
                <td className="px-3 py-2 text-xs text-[#334155]">{formatDate(item.createdAt)}</td>
              </tr>
            ))}

            {!auditQuery.data || auditQuery.data.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-[#64748b]" colSpan={4}>
                  {t('empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
