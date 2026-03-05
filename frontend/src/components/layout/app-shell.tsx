import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  FolderKanban,
  FolderTree,
  GitBranch,
  ListChecks,
  Menu,
  Search,
  Settings,
  Star,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { listSites } from '../../api/dms';
import { supportedLocales } from '../../i18n';
import { useAuth } from '../../features/auth/auth-context';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Sheet, SheetContent } from '../ui/sheet';
import { cn } from '../../lib/utils';

export function AppShell() {
  const { t, i18n } = useTranslation('common');
  const { user, logout } = useAuth();
  const [openSites, setOpenSites] = useState<Record<string, boolean>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('openged.sidebar.collapsed') === 'true',
  );

  const sitesQuery = useQuery({
    queryKey: ['sites-nav'],
    queryFn: listSites,
  });

  const isAdmin = useMemo(
    () => Boolean(user?.roles.includes('SUPER_ADMIN') || user?.roles.includes('GLOBAL_ADMIN')),
    [user?.roles],
  );

  const mainLinks = useMemo(
    () => [
      { to: '/sites', label: t('nav.sites'), icon: FolderTree },
      { to: '/recent', label: t('nav.recent'), icon: Clock3 },
      { to: '/favorites', label: t('nav.favorites'), icon: Star },
      { to: '/tasks', label: t('nav.tasks'), icon: ListChecks },
    ],
    [t],
  );

  useEffect(() => {
    localStorage.setItem('openged.sidebar.collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const renderNavigation = ({
    closeOnNavigate = false,
    collapsed = false,
  }: {
    closeOnNavigate?: boolean;
    collapsed?: boolean;
  }) => (
    <>
      {!collapsed ? (
        <div className="border-b border-[#e2e8f0] p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
            <Input placeholder={t('search')} className="pl-9" />
          </div>
        </div>
      ) : null}

      <ScrollArea className={collapsed ? 'h-[calc(100vh-4rem)]' : 'h-[calc(100vh-8.5rem)]'}>
        <nav className={cn('space-y-4 p-3', collapsed && 'px-2')}>
          <div className="space-y-1">
            {mainLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  title={link.label}
                  onClick={() => {
                    if (closeOnNavigate) {
                      setMobileNavOpen(false);
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#334155] transition hover:bg-[#f1f5f9]',
                      isActive && 'bg-[#eff6ff] text-[#1d4ed8]',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {collapsed ? null : link.label}
                </NavLink>
              );
            })}
          </div>

          {!collapsed ? (
            <div className="space-y-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{t('nav.sites')}</p>

              {sitesQuery.data?.map((site) => {
                const expanded = openSites[site.id] ?? true;
                return (
                  <div key={site.id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc]">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSites((current) => ({
                          ...current,
                          [site.id]: !expanded,
                        }))
                      }
                      className="flex w-full items-center justify-between px-2.5 py-2 text-left text-sm font-medium text-[#0f172a]"
                    >
                      <span className="truncate">{site.name}</span>
                      <FolderKanban className="h-4 w-4 text-[#64748b]" />
                    </button>

                    {expanded ? (
                      <div className="space-y-1 border-t border-[#e2e8f0] px-1 py-1.5">
                        {site.libraries.map((library) => (
                          <NavLink
                            key={library.id}
                            to={`/sites/${site.id}/libraries/${library.id}`}
                            onClick={() => {
                              if (closeOnNavigate) {
                                setMobileNavOpen(false);
                              }
                            }}
                            className={({ isActive }) =>
                              cn(
                                'block rounded-md px-2 py-1.5 text-sm text-[#475569] hover:bg-white',
                                isActive && 'bg-white text-[#1d4ed8] shadow-sm',
                              )
                            }
                          >
                            {library.name}
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {isAdmin ? (
            <div className="space-y-1">
              {!collapsed ? (
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{t('nav.admin')}</p>
              ) : null}
              <NavLink
                to="/admin/workflows/designer"
                title={t('nav.workflows')}
                onClick={() => {
                  if (closeOnNavigate) {
                    setMobileNavOpen(false);
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#334155] transition hover:bg-[#f1f5f9]',
                    isActive && 'bg-[#eff6ff] text-[#1d4ed8]',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <GitBranch className="h-4 w-4" />
                {collapsed ? null : t('nav.workflows')}
              </NavLink>
              <NavLink
                to="/admin/users"
                title={t('nav.users')}
                onClick={() => {
                  if (closeOnNavigate) {
                    setMobileNavOpen(false);
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#334155] transition hover:bg-[#f1f5f9]',
                    isActive && 'bg-[#eff6ff] text-[#1d4ed8]',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <Users className="h-4 w-4" />
                {collapsed ? null : t('nav.users')}
              </NavLink>
              <NavLink
                to="/audit"
                title={t('nav.audit')}
                onClick={() => {
                  if (closeOnNavigate) {
                    setMobileNavOpen(false);
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[#334155] transition hover:bg-[#f1f5f9]',
                    isActive && 'bg-[#eff6ff] text-[#1d4ed8]',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <Settings className="h-4 w-4" />
                {collapsed ? null : t('nav.audit')}
              </NavLink>
            </div>
          ) : null}
        </nav>
      </ScrollArea>
    </>
  );

  return (
    <div
      className={cn(
        'grid min-h-screen overflow-x-hidden',
        isSidebarCollapsed ? 'md:grid-cols-[72px_minmax(0,1fr)]' : 'md:grid-cols-[280px_minmax(0,1fr)]',
      )}
    >
      <aside className="hidden border-r border-[#e2e8f0] bg-white/90 backdrop-blur md:block">
        <div className="flex h-16 items-center justify-between border-b border-[#e2e8f0] px-4">
          <Link
            to="/sites"
            className="flex min-w-0 items-center gap-2"
          >
            <img src="/openged-logo.png" alt={t('appName')} className="h-8 w-auto shrink-0" />
            <span
              className={cn(
                'truncate text-lg font-semibold tracking-tight text-[#0f172a]',
                isSidebarCollapsed && 'hidden',
              )}
            >
              {t('appName')}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {!isSidebarCollapsed ? <ShieldCheck className="h-4 w-4 text-[#2563eb]" /> : null}
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              aria-label={isSidebarCollapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
              title={isSidebarCollapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
            >
              {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {renderNavigation({ collapsed: isSidebarCollapsed })}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e2e8f0] bg-white/90 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label={t('shell.openMenu')}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <p className="text-xs uppercase tracking-wide text-[#94a3b8]">{t('shell.workspace')}</p>
            <p className="text-sm font-semibold text-[#0f172a]">{t('shell.title')}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-36">
              <Select
                value={i18n.language.split('-')[0]}
                onValueChange={(locale) => {
                  void i18n.changeLanguage(locale);
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={t('language.label')} />
                </SelectTrigger>
                <SelectContent>
                  {supportedLocales.map((locale) => (
                    <SelectItem key={locale} value={locale}>
                      {t(`language.${locale}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-right text-xs">
              <p className="font-semibold text-[#0f172a]">{user?.email}</p>
              <p className="text-[11px] text-[#64748b]">{user?.roles.join(' · ')}</p>
              <button type="button" className="text-[#2563eb]" onClick={logout}>
                {t('signOut')}
              </button>
            </div>
            <Avatar>
              <AvatarFallback>{user?.email?.slice(0, 2).toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden p-4 md:p-5">
          <Outlet />
        </main>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[280px] border-r border-[#e2e8f0] p-0">
          <div className="flex h-16 items-center justify-between border-b border-[#e2e8f0] px-4">
            <Link
              to="/sites"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#0f172a]"
              onClick={() => setMobileNavOpen(false)}
            >
              <img src="/openged-logo.png" alt={t('appName')} className="h-8 w-auto shrink-0" />
              <span>{t('appName')}</span>
            </Link>
            <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
          </div>
          {renderNavigation({ closeOnNavigate: true })}
        </SheetContent>
      </Sheet>
    </div>
  );
}
