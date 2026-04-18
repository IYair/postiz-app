#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

# Some sub-scripts historically expect /app/.env to exist; harmless no-op.
: >/app/.env

echo "[entrypoint] applying Prisma schema (db push, no data loss)..."
prisma db push \
  --skip-generate \
  --schema /app/libraries/nestjs-libraries/src/database/prisma/schema.prisma

echo "[entrypoint] starting pm2-runtime (supervises nginx, backend, orchestrator, frontend)..."
exec pm2-runtime start /app/ecosystem.config.cjs
