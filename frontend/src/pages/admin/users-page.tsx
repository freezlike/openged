import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createAdminUser, getAdminRoles, getAdminUsers, updateAdminUserRoles } from '../../api/admin';
import { useAuth } from '../../features/auth/auth-context';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { formatDate } from '../../lib/utils';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';

function toggleRole(roleCodes: string[], roleCode: string) {
  if (roleCodes.includes(roleCode)) {
    return roleCodes.filter((role) => role !== roleCode);
  }

  return [...roleCodes, roleCode];
}

export function UsersPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRoles, setEditingRoles] = useState<string[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['READER']);
  const debouncedSearch = useDebouncedValue(search, 250);

  const canManageUsers = useMemo(
    () => Boolean(user?.roles.includes('SUPER_ADMIN') || user?.roles.includes('GLOBAL_ADMIN')),
    [user?.roles],
  );

  const rolesQuery = useQuery({
    queryKey: ['admin-roles'],
    queryFn: getAdminRoles,
    enabled: canManageUsers,
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users', debouncedSearch],
    queryFn: () => getAdminUsers({ q: debouncedSearch, pageSize: 100 }),
    enabled: canManageUsers,
  });

  const createUserMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: async () => {
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRoles(['READER']);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: (params: { userId: string; roles: string[] }) => updateAdminUserRoles(params.userId, params.roles),
    onSuccess: async () => {
      setEditingUserId(null);
      setEditingRoles([]);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  if (!canManageUsers) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-[#64748b]">{t('users.noAccess')}</CardContent>
      </Card>
    );
  }

  const onCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword || newUserRoles.length === 0) {
      return;
    }

    createUserMutation.mutate({
      email: newUserEmail.trim(),
      password: newUserPassword,
      roles: newUserRoles,
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-[#0f172a]">{t('users.title')}</h1>
        <p className="text-sm text-[#64748b]">{t('users.description')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('users.create.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreateUser}>
            <Input
              placeholder={t('users.create.email')}
              type="email"
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              required
            />
            <Input
              placeholder={t('users.create.password')}
              type="password"
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
              required
            />
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium text-[#334155]">{t('users.create.roles')}</p>
              <div className="flex flex-wrap gap-3">
                {rolesQuery.data?.map((role) => (
                  <label key={role.code} className="flex items-center gap-2 text-sm text-[#334155]">
                    <Checkbox
                      checked={newUserRoles.includes(role.code)}
                      onCheckedChange={() => setNewUserRoles((current) => toggleRole(current, role.code))}
                    />
                    <span>{role.code}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createUserMutation.isPending || newUserRoles.length === 0}>
                {t('users.create.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('users.list.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder={t('users.list.search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {usersQuery.isError ? (
            <p className="text-sm text-[#dc2626]">{t('users.list.loadError')}</p>
          ) : null}

          <div className="space-y-2">
            {usersQuery.data?.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-[#e2e8f0] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#0f172a]">{item.email}</p>
                    <p className="text-xs text-[#64748b]">
                      {t('users.list.createdAt')}: {formatDate(item.createdAt)} • {t('users.list.lastLogin')}:{' '}
                      {item.lastLogin ? formatDate(item.lastLogin) : '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{t(`users.status.${item.status}`)}</Badge>
                    <Badge>{t(`users.authSource.${item.authSource}`)}</Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingUserId(item.id);
                        setEditingRoles(item.roles);
                      }}
                    >
                      {t('users.list.editRoles')}
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {item.roles.map((role) => (
                    <Badge key={`${item.id}-${role}`}>{role}</Badge>
                  ))}
                </div>

                {editingUserId === item.id ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-[#dbeafe] bg-[#eff6ff] p-3">
                    <p className="text-sm font-medium text-[#1e3a8a]">{t('users.list.roleEditor')}</p>
                    <div className="flex flex-wrap gap-3">
                      {rolesQuery.data?.map((role) => (
                        <label key={`${item.id}-${role.code}`} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={editingRoles.includes(role.code)}
                            onCheckedChange={() => setEditingRoles((current) => toggleRole(current, role.code))}
                          />
                          <span>{role.code}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateRolesMutation.mutate({ userId: item.id, roles: editingRoles })}
                        disabled={updateRolesMutation.isPending || editingRoles.length === 0}
                      >
                        {t('common:actions.save')}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingUserId(null);
                          setEditingRoles([]);
                        }}
                      >
                        {t('common:actions.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {!usersQuery.isLoading && (usersQuery.data?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-[#64748b]">{t('users.list.empty')}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
