import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { getSsoProviders } from '../api/auth';
import { fetchInstallerStatus } from '../api/installer';
import { useAuth } from '../features/auth/auth-context';
import { supportedLocales } from '../i18n';

export function LoginPage() {
  const { t, i18n } = useTranslation(['auth', 'common']);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [ssoProviders, setSsoProviders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    const load = async () => {
      try {
        const status = await fetchInstallerStatus();
        if (!status.installed) {
          navigate('/install', { replace: true });
          return;
        }

        const providers = await getSsoProviders();
        setSsoProviders(providers);
      } catch {
        // Keep page usable even if API not yet available.
      }
    };

    void load();
  }, [navigate, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setError(t('auth:login.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <select
            value={i18n.language.split('-')[0]}
            onChange={(event) => {
              void i18n.changeLanguage(event.target.value);
            }}
            className="input h-9 w-36 py-1"
            aria-label={t('common:language.label')}
          >
            {supportedLocales.map((locale) => (
              <option key={locale} value={locale}>
                {t(`common:language.${locale}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-center">
          <img src="/openged-logo.png" alt={t('common:appName')} className="h-20 w-auto" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{t('auth:login.title')}</h1>
          <p className="mt-1 text-sm text-slate">{t('auth:login.subtitle')}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold text-slate">
            {t('auth:login.email')}
            <input
              className="input mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-semibold text-slate">
            {t('auth:login.password')}
            <input
              className="input mt-1"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="text-sm text-ember">{error}</p> : null}

          <button disabled={loading} type="submit" className="btn-primary w-full">
            {loading ? t('auth:login.signingIn') : t('auth:login.signIn')}
          </button>
        </form>

        {ssoProviders.length > 0 ? (
          <div className="rounded-md border border-dashed border-slate/25 p-3 text-sm text-slate">
            <p className="font-semibold">{t('auth:login.ssoAvailable')}</p>
            <p className="mt-1">
              {t('auth:login.providers')}: <span className="font-mono">{ssoProviders.join(', ')}</span>
            </p>
          </div>
        ) : null}

        <Link to="/install" className="block text-center text-sm font-semibold text-tide underline">
          {t('auth:login.goInstaller')}
        </Link>
      </div>
    </div>
  );
}
