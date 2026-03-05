#!/usr/bin/env node

const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:5173';

const routes = ['/', '/login', '/sites', '/tasks', '/audit'];

async function request(path) {
  const response = await fetch(`${webBaseUrl}${path}`);
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body: text,
  };
}

function assert(condition, message, details) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function main() {
  for (const route of routes) {
    const response = await request(route);

    assert(response.ok, `Route ${route} is not reachable`, response.status);
    assert(response.body.includes('<div id="root">'), `Route ${route} is not serving SPA shell`);
  }

  // eslint-disable-next-line no-console
  console.log('[smoke-web] OK');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        webBaseUrl,
        checkedRoutes: routes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[smoke-web] FAILED');
  // eslint-disable-next-line no-console
  console.error(error.message);

  if (error.details) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(error.details, null, 2));
  }

  process.exit(1);
});
