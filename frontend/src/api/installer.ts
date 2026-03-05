import { api } from './client';
import { InstallerStatus } from '../types/models';

export async function fetchInstallerStatus() {
  const { data } = await api.get<InstallerStatus>('/install/status');
  return data;
}

export async function fetchSystemChecks() {
  const { data } = await api.get('/install/system-checks');
  return data;
}

export async function saveOrganization(payload: {
  organizationName: string;
  timezone: string;
  language: string;
  technicalEmail: string;
}) {
  const { data } = await api.post('/install/organization', payload);
  return data;
}

export async function createInstallAdmin(payload: {
  email: string;
  password: string;
  mfaEnabled: boolean;
}) {
  const { data } = await api.post('/install/admin', payload);
  return data;
}

export async function saveInstallFeatures(payload: {
  enableSearch: boolean;
  enableSso: boolean;
  enableEmailNotifications: boolean;
  authMode: 'LOCAL_ONLY' | 'LOCAL_AND_SSO' | 'SSO_ONLY';
}) {
  const { data } = await api.post('/install/features', payload);
  return data;
}

export async function bootstrapGed() {
  const { data } = await api.post('/install/bootstrap-ged');
  return data;
}

export async function finalizeInstallation() {
  const { data } = await api.post('/install/finalize', { appVersion: '1.0.0' });
  return data;
}
