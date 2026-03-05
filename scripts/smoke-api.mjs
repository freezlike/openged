#!/usr/bin/env node

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || 'ChangeMe123!';
const validatorEmail = process.env.SMOKE_VALIDATOR_EMAIL || 'validator@example.com';
const validatorPassword = process.env.SMOKE_VALIDATOR_PASSWORD || 'ChangeMe123!';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', token, body, timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data = text;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function waitForHealth(maxAttempts = 60) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const health = await request('/health', { timeoutMs: 4_000 });

    if (health.ok) {
      return health.data;
    }

    await sleep(2_000);
  }

  throw new Error(`API did not become healthy at ${apiBaseUrl}/health`);
}

async function login(email, password) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  assert(response.ok, `Login failed for ${email}`, response);
  assert(response.data?.accessToken, `No access token returned for ${email}`, response.data);

  return response.data.accessToken;
}

async function main() {
  const health = await waitForHealth();

  const status = await request('/install/status');
  assert(status.ok, 'Failed to fetch install status', status);
  assert(status.data?.installed === true, 'Application is not finalized (installed=false)', status.data);

  const adminToken = await login(adminEmail, adminPassword);

  const sites = await request('/dms/sites', { token: adminToken });
  assert(sites.ok, 'Failed to fetch sites', sites);
  assert(Array.isArray(sites.data) && sites.data.length > 0, 'No site found', sites.data);

  const firstSite = sites.data[0];
  assert(Array.isArray(firstSite.libraries) && firstSite.libraries.length > 0, 'No library found in first site', firstSite);

  const firstLibrary = firstSite.libraries[0];

  const items = await request(`/dms/libraries/${firstLibrary.id}/items?pageSize=50`, {
    token: adminToken,
  });
  assert(items.ok, 'Failed to fetch library items', items);
  assert(items.data?.folders?.length >= 1, 'Expected seeded folders in library', items.data);
  assert(items.data?.documents?.length >= 1, 'Expected at least one root document in library', items.data);

  const firstDocument = items.data.documents[0];

  const details = await request(`/documents/${firstDocument.id}`, { token: adminToken });
  assert(details.ok, 'Failed to fetch document details', details);

  const activity = await request(`/documents/${firstDocument.id}/activity`, { token: adminToken });
  assert(activity.ok, 'Failed to fetch document activity', activity);

  const workflowHistory = await request(`/documents/${firstDocument.id}/workflows/history`, {
    token: adminToken,
  });
  assert(workflowHistory.ok, 'Failed to fetch workflow history', workflowHistory);

  const workflows = await request(`/workflows/available?libraryId=${firstLibrary.id}`, {
    token: adminToken,
  });
  assert(workflows.ok, 'Failed to fetch available workflows', workflows);
  assert(Array.isArray(workflows.data) && workflows.data.length >= 1, 'No workflow template available', workflows.data);

  const download = await fetch(`${apiBaseUrl}/documents/${firstDocument.id}/download`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert(download.ok, 'Failed to download document', { status: download.status });
  const downloadBuffer = await download.arrayBuffer();
  assert(downloadBuffer.byteLength > 0, 'Downloaded document is empty');

  const validatorToken = await login(validatorEmail, validatorPassword);
  const myTasks = await request('/tasks/my', { token: validatorToken });
  assert(myTasks.ok, 'Failed to fetch validator tasks', myTasks);
  assert(Array.isArray(myTasks.data), 'Invalid tasks payload', myTasks.data);
  assert(myTasks.data.length >= 1, 'Expected at least one seeded validator task', myTasks.data);

  const summary = {
    apiBaseUrl,
    health,
    siteCount: sites.data.length,
    libraryId: firstLibrary.id,
    folderCount: items.data.folders.length,
    rootDocumentCount: items.data.documents.length,
    firstDocument: firstDocument.title,
    workflowTemplateCount: workflows.data.length,
    validatorTaskCount: myTasks.data.length,
  };

  // eslint-disable-next-line no-console
  console.log('[smoke-api] OK');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[smoke-api] FAILED');
  // eslint-disable-next-line no-console
  console.error(error.message);

  if (error.details) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(error.details, null, 2));
  }

  process.exit(1);
});
