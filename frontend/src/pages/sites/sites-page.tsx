import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { listSites } from '../../api/dms';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export function SitesPage() {
  const sitesQuery = useQuery({
    queryKey: ['sites-list'],
    queryFn: listSites,
  });

  if (sitesQuery.isLoading) {
    return <p className="text-sm text-[#64748b]">Loading sites...</p>;
  }

  const sites = sitesQuery.data ?? [];

  if (sites.length === 1 && sites[0].libraries.length > 0) {
    return <Navigate to={`/sites/${sites[0].id}/libraries/${sites[0].libraries[0].id}`} replace />;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#0f172a]">Sites</h1>
        <p className="text-sm text-[#64748b]">Choose a site and library to open the modern document experience.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <Card key={site.id}>
            <CardHeader>
              <CardTitle>{site.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {site.libraries.map((library) => (
                <Link
                  key={library.id}
                  to={`/sites/${site.id}/libraries/${library.id}`}
                  className="block rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]"
                >
                  {library.name}
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
