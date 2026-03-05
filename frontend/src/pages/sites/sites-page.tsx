import { FormEvent, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createLibrary, createSite, listSites } from '../../api/dms';
import { useAuth } from '../../features/auth/auth-context';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export function SitesPage() {
  const { t } = useTranslation('library');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [libraryDrafts, setLibraryDrafts] = useState<Record<string, { open: boolean; name: string }>>({});

  const canManageSites = useMemo(
    () =>
      Boolean(
        user?.roles.some((role) => ['SITE_ADMIN', 'GLOBAL_ADMIN', 'SUPER_ADMIN'].includes(role)),
      ),
    [user?.roles],
  );

  const sitesQuery = useQuery({
    queryKey: ['sites-list'],
    queryFn: listSites,
  });

  const createSiteMutation = useMutation({
    mutationFn: createSite,
    onSuccess: async () => {
      setSiteName('');
      setSiteDescription('');
      setShowCreateSite(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sites-list'] }),
        queryClient.invalidateQueries({ queryKey: ['sites-nav'] }),
      ]);
    },
  });

  const createLibraryMutation = useMutation({
    mutationFn: (params: { siteId: string; name: string }) => createLibrary(params.siteId, { name: params.name }),
    onSuccess: async (_data, variables) => {
      setLibraryDrafts((current) => ({
        ...current,
        [variables.siteId]: { open: false, name: '' },
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sites-list'] }),
        queryClient.invalidateQueries({ queryKey: ['sites-nav'] }),
      ]);
    },
  });

  if (sitesQuery.isLoading) {
    return <p className="text-sm text-[#64748b]">{t('sites.loading')}</p>;
  }

  const sites = sitesQuery.data ?? [];

  if (sites.length === 1 && sites[0].libraries.length > 0) {
    return <Navigate to={`/sites/${sites[0].id}/libraries/${sites[0].libraries[0].id}`} replace />;
  }

  const onCreateSite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!siteName.trim()) {
      return;
    }
    createSiteMutation.mutate({ name: siteName.trim(), description: siteDescription.trim() || undefined });
  };

  const onCreateLibrary = (event: FormEvent<HTMLFormElement>, siteId: string) => {
    event.preventDefault();
    const draft = libraryDrafts[siteId];
    if (!draft?.name.trim()) {
      return;
    }
    createLibraryMutation.mutate({ siteId, name: draft.name.trim() });
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">{t('sites.title')}</h1>
          <p className="text-sm text-[#64748b]">{t('sites.description')}</p>
        </div>
        {canManageSites ? (
          <Button
            size="sm"
            onClick={() => setShowCreateSite((current) => !current)}
            variant={showCreateSite ? 'secondary' : 'default'}
          >
            {showCreateSite ? t('sites.actions.cancel') : t('sites.actions.newSite')}
          </Button>
        ) : null}
      </header>

      {showCreateSite && canManageSites ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('sites.actions.newSite')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-2 md:grid-cols-[2fr_2fr_auto]" onSubmit={onCreateSite}>
              <Input
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                placeholder={t('sites.form.siteName')}
                required
              />
              <Input
                value={siteDescription}
                onChange={(event) => setSiteDescription(event.target.value)}
                placeholder={t('sites.form.siteDescription')}
              />
              <Button type="submit" disabled={createSiteMutation.isPending}>
                {t('sites.actions.create')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <Card key={site.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">{site.name}</span>
                {canManageSites ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setLibraryDrafts((current) => ({
                        ...current,
                        [site.id]: {
                          open: !(current[site.id]?.open ?? false),
                          name: current[site.id]?.name ?? '',
                        },
                      }))
                    }
                  >
                    {t('sites.actions.newLibrary')}
                  </Button>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {site.libraries.length === 0 ? (
                <p className="text-sm text-[#94a3b8]">{t('sites.emptyLibraries')}</p>
              ) : null}
              {site.libraries.map((library) => (
                <Link
                  key={library.id}
                  to={`/sites/${site.id}/libraries/${library.id}`}
                  className="block rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
                >
                  {library.name}
                </Link>
              ))}

              {canManageSites && libraryDrafts[site.id]?.open ? (
                <form onSubmit={(event) => onCreateLibrary(event, site.id)} className="space-y-2 border-t border-[#e2e8f0] pt-2">
                  <Input
                    value={libraryDrafts[site.id]?.name ?? ''}
                    onChange={(event) =>
                      setLibraryDrafts((current) => ({
                        ...current,
                        [site.id]: {
                          open: true,
                          name: event.target.value,
                        },
                      }))
                    }
                    placeholder={t('sites.form.libraryName')}
                    required
                  />
                  <Button type="submit" size="sm" disabled={createLibraryMutation.isPending}>
                    {t('sites.actions.create')}
                  </Button>
                </form>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
