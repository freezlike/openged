import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getSsoProviders } from '../api/auth';
import { fetchInstallerStatus } from '../api/installer';
import { useAuth } from '../features/auth/auth-context';

export function LoginPage() {
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
      setError('Invalid credentials or authentication mode restriction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="card w-full max-w-md space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">OpenGED</h1>
          <p className="mt-1 text-sm text-slate">Secure document management platform</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-semibold text-slate">
            Email
            <input
              className="input mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-semibold text-slate">
            Password
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
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {ssoProviders.length > 0 ? (
          <div className="rounded-md border border-dashed border-slate/25 p-3 text-sm text-slate">
            <p className="font-semibold">SSO available</p>
            <p className="mt-1">
              Providers: <span className="font-mono">{ssoProviders.join(', ')}</span>
            </p>
          </div>
        ) : null}

        <Link to="/install" className="block text-center text-sm font-semibold text-tide underline">
          Go to installer
        </Link>
      </div>
    </div>
  );
}
