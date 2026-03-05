#!/bin/sh
set -e

echo "[OpenGED] Waiting for PostgreSQL and applying migrations..."
until npx prisma migrate deploy; do
  echo "[OpenGED] Database not ready yet, retrying in 5s..."
  sleep 5
done

echo "[OpenGED] Seeding baseline data..."
npm run prisma:seed

echo "[OpenGED] Starting API..."
if [ -f dist/main.js ]; then
  exec node dist/main.js
fi

exec node dist/src/main.js
