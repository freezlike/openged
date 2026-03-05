import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  bootstrapGed,
  createInstallAdmin,
  fetchInstallerStatus,
  fetchSystemChecks,
  finalizeInstallation,
  saveInstallFeatures,
  saveOrganization,
} from '../api/installer';

const steps = [
  'System checks',
  'Organization settings',
  'Admin creation',
  'Optional features',
  'Initial GED setup',
  'Finalization',
];

export function InstallPage() {
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [checks, setChecks] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [org, setOrg] = useState({
    organizationName: 'OpenGED Organization',
    timezone: 'UTC',
    language: 'en',
    technicalEmail: 'it@example.com',
  });

  const [admin, setAdmin] = useState({
    email: 'admin@example.com',
    password: 'ChangeMe123!',
    mfaEnabled: false,
  });

  const [features, setFeatures] = useState({
    enableSearch: false,
    enableSso: false,
    enableEmailNotifications: false,
    authMode: 'LOCAL_ONLY' as 'LOCAL_ONLY' | 'LOCAL_AND_SSO' | 'SSO_ONLY',
  });

  useEffect(() => {
    const init = async () => {
      try {
        const status = await fetchInstallerStatus();
        if (status.installed) {
          navigate('/login', { replace: true });
          return;
        }

        const systemChecks = await fetchSystemChecks();
        setChecks(systemChecks as Record<string, unknown>);
      } catch {
        setError('Cannot reach installer API. Start backend first.');
      }
    };

    void init();
  }, [navigate]);

  const canContinue = useMemo(() => !busy, [busy]);

  const nextStep = () => setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  const prevStep = () => setActiveStep((current) => Math.max(current - 1, 0));

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);

    try {
      await action();
      nextStep();
    } catch {
      setError('Installer step failed. Check backend logs for details.');
    } finally {
      setBusy(false);
    }
  };

  const onOrgSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runAction(async () => {
      await saveOrganization(org);
    });
  };

  const onAdminSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runAction(async () => {
      await createInstallAdmin(admin);
    });
  };

  const onFeaturesSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await runAction(async () => {
      await saveInstallFeatures(features);
    });
  };

  const onBootstrap = async () => {
    await runAction(async () => {
      await bootstrapGed();
    });
  };

  const onFinalize = async () => {
    await runAction(async () => {
      await finalizeInstallation();
      navigate('/login', { replace: true });
    });
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold">OpenGED Installer</h1>
        <p className="mt-1 text-sm text-slate">First deployment wizard for OpenGED</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="card h-fit">
          <ol className="space-y-2 text-sm">
            {steps.map((label, index) => (
              <li
                key={label}
                className={`rounded px-2 py-1 ${
                  index === activeStep
                    ? 'bg-ink text-white'
                    : index < activeStep
                      ? 'bg-tide/10 text-tide'
                      : 'text-slate'
                }`}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>
        </aside>

        <section className="card space-y-4">
          {error ? <p className="rounded bg-ember/10 p-3 text-sm text-ember">{error}</p> : null}

          {activeStep === 0 ? (
            <>
              <h2 className="font-display text-xl font-semibold">System checks</h2>
              <pre className="max-h-80 overflow-auto rounded bg-slate/95 p-3 font-mono text-xs text-white">
                {JSON.stringify(checks, null, 2)}
              </pre>
              <button disabled={!canContinue} className="btn-primary" onClick={nextStep} type="button">
                Continue
              </button>
            </>
          ) : null}

          {activeStep === 1 ? (
            <form onSubmit={onOrgSubmit} className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Organization settings</h2>
              <input
                className="input"
                value={org.organizationName}
                onChange={(event) => setOrg((value) => ({ ...value, organizationName: event.target.value }))}
                placeholder="Organization name"
              />
              <input
                className="input"
                value={org.timezone}
                onChange={(event) => setOrg((value) => ({ ...value, timezone: event.target.value }))}
                placeholder="Timezone"
              />
              <input
                className="input"
                value={org.language}
                onChange={(event) => setOrg((value) => ({ ...value, language: event.target.value }))}
                placeholder="Language"
              />
              <input
                className="input"
                type="email"
                value={org.technicalEmail}
                onChange={(event) => setOrg((value) => ({ ...value, technicalEmail: event.target.value }))}
                placeholder="Technical email"
              />
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={prevStep}>
                  Back
                </button>
                <button disabled={busy} className="btn-primary" type="submit">
                  Save and continue
                </button>
              </div>
            </form>
          ) : null}

          {activeStep === 2 ? (
            <form onSubmit={onAdminSubmit} className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Admin account</h2>
              <input
                className="input"
                type="email"
                value={admin.email}
                onChange={(event) => setAdmin((value) => ({ ...value, email: event.target.value }))}
                placeholder="Admin email"
              />
              <input
                className="input"
                type="password"
                value={admin.password}
                onChange={(event) => setAdmin((value) => ({ ...value, password: event.target.value }))}
                placeholder="Password"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={admin.mfaEnabled}
                  onChange={(event) => setAdmin((value) => ({ ...value, mfaEnabled: event.target.checked }))}
                  type="checkbox"
                />
                Enable MFA later
              </label>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={prevStep}>
                  Back
                </button>
                <button disabled={busy} className="btn-primary" type="submit">
                  Create admin
                </button>
              </div>
            </form>
          ) : null}

          {activeStep === 3 ? (
            <form onSubmit={onFeaturesSubmit} className="space-y-3">
              <h2 className="font-display text-xl font-semibold">Optional features</h2>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={features.enableSearch}
                  onChange={(event) =>
                    setFeatures((value) => ({ ...value, enableSearch: event.target.checked }))
                  }
                  type="checkbox"
                />
                Enable search engine
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={features.enableSso}
                  onChange={(event) => setFeatures((value) => ({ ...value, enableSso: event.target.checked }))}
                  type="checkbox"
                />
                Enable SSO
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={features.enableEmailNotifications}
                  onChange={(event) =>
                    setFeatures((value) => ({ ...value, enableEmailNotifications: event.target.checked }))
                  }
                  type="checkbox"
                />
                Enable email notifications
              </label>
              <select
                className="input"
                value={features.authMode}
                onChange={(event) =>
                  setFeatures((value) => ({
                    ...value,
                    authMode: event.target.value as 'LOCAL_ONLY' | 'LOCAL_AND_SSO' | 'SSO_ONLY',
                  }))
                }
              >
                <option value="LOCAL_ONLY">LOCAL_ONLY</option>
                <option value="LOCAL_AND_SSO">LOCAL_AND_SSO</option>
                <option value="SSO_ONLY">SSO_ONLY</option>
              </select>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={prevStep}>
                  Back
                </button>
                <button disabled={busy} className="btn-primary" type="submit">
                  Save features
                </button>
              </div>
            </form>
          ) : null}

          {activeStep === 4 ? (
            <>
              <h2 className="font-display text-xl font-semibold">Initial GED setup</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate">
                <li>Site: General</li>
                <li>Library: Documents</li>
                <li>Taxonomies: Confidentiality, Domain</li>
                <li>Content types: Document, Procedure, Contract, Invoice</li>
              </ul>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={prevStep}>
                  Back
                </button>
                <button disabled={busy} className="btn-primary" onClick={onBootstrap} type="button">
                  Create initial structure
                </button>
              </div>
            </>
          ) : null}

          {activeStep === 5 ? (
            <>
              <h2 className="font-display text-xl font-semibold">Finalize</h2>
              <p className="text-sm text-slate">
                Finalization runs migrations/seed assumptions, marks installation as complete, and disables installer.
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={prevStep}>
                  Back
                </button>
                <button disabled={busy} className="btn-primary" onClick={onFinalize} type="button">
                  Finalize installation
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
