# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.20-bookworm-slim
ARG PNPM_VERSION=10.6.1

# =============================================================================
# Stage 1: builder-base — toolchain for native modules (canvas, sharp, bcrypt)
# =============================================================================
FROM node:${NODE_VERSION} AS builder-base
ARG PNPM_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
      g++ make python3 pkg-config ca-certificates \
      libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@${PNPM_VERSION} prisma@6.5.0 \
      --no-update-notifier --no-fund

WORKDIR /app

# =============================================================================
# Stage 2: deps — install full deps for build (cached by lockfile)
# Only apps/* are real pnpm workspaces; libraries/* have no package.json.
# =============================================================================
FROM builder-base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json      apps/backend/package.json
COPY apps/frontend/package.json     apps/frontend/package.json
COPY apps/orchestrator/package.json apps/orchestrator/package.json
COPY apps/commands/package.json     apps/commands/package.json
COPY apps/extension/package.json    apps/extension/package.json
COPY apps/sdk/package.json          apps/sdk/package.json
COPY libraries/nestjs-libraries/src/database/prisma/schema.prisma \
     libraries/nestjs-libraries/src/database/prisma/schema.prisma

# Skip postinstall here: we'll run prisma generate explicitly after.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts \
 && prisma generate \
      --schema /app/libraries/nestjs-libraries/src/database/prisma/schema.prisma

# =============================================================================
# Stage 3: builder — compile backend + orchestrator + frontend
# =============================================================================
FROM deps AS builder

ARG NEXT_PUBLIC_VERSION
ENV NEXT_PUBLIC_VERSION=${NEXT_PUBLIC_VERSION}
ENV NEXT_TELEMETRY_DISABLED=1
ENV DISABLE_SOURCE_MAPS=true
ENV SENTRY_DISABLE=true
ENV NODE_ENV=production

COPY . .

# Native builds (bcrypt) once scripts are needed for compilation
RUN pnpm rebuild bcrypt || true

RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# =============================================================================
# Stage 4: prod-deps — install runtime deps only, pre-generate Prisma client
# =============================================================================
FROM builder-base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json      apps/backend/package.json
COPY apps/frontend/package.json     apps/frontend/package.json
COPY apps/orchestrator/package.json apps/orchestrator/package.json
COPY apps/commands/package.json     apps/commands/package.json
COPY apps/extension/package.json    apps/extension/package.json
COPY apps/sdk/package.json          apps/sdk/package.json
COPY libraries/nestjs-libraries/src/database/prisma/schema.prisma \
     libraries/nestjs-libraries/src/database/prisma/schema.prisma

# --ignore-scripts to avoid dlx postinstall; bcrypt rebuild below; prisma generate after.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts \
 && pnpm rebuild bcrypt \
 && prisma generate \
      --schema /app/libraries/nestjs-libraries/src/database/prisma/schema.prisma

# =============================================================================
# Stage 5: runner — minimal runtime image
# =============================================================================
FROM node:${NODE_VERSION} AS runner
ARG PNPM_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
      nginx tini ca-certificates openssl curl \
      libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g --no-update-notifier --no-fund \
      pnpm@${PNPM_VERSION} pm2 prisma@6.5.0

RUN addgroup --system www \
 && adduser  --system --ingroup www --home /www --shell /usr/sbin/nologin www \
 && mkdir -p /www /uploads /config \
 && chown -R www:www /www /var/lib/nginx /uploads /config

WORKDIR /app

# Workspace metadata
COPY --from=builder /app/package.json       ./package.json
COPY --from=builder /app/pnpm-lock.yaml     ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/.npmrc             ./.npmrc

# Prod node_modules (includes generated Prisma client under .prisma/)
COPY --from=prod-deps /app/node_modules ./node_modules

# Libraries source (referenced at runtime by compiled dist + prisma schema)
COPY --from=builder /app/libraries ./libraries

# Backend
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/apps/backend/dist         ./apps/backend/dist

# Orchestrator
COPY --from=builder /app/apps/orchestrator/package.json ./apps/orchestrator/package.json
COPY --from=builder /app/apps/orchestrator/dist         ./apps/orchestrator/dist

# Frontend — full .next, then drop build-time cache to keep image small
COPY --from=builder /app/apps/frontend/package.json  ./apps/frontend/package.json
COPY --from=builder /app/apps/frontend/next.config.js ./apps/frontend/next.config.js
COPY --from=builder /app/apps/frontend/public        ./apps/frontend/public
COPY --from=builder /app/apps/frontend/.next         ./apps/frontend/.next
RUN rm -rf ./apps/frontend/.next/cache

# nginx + pm2 ecosystem + entrypoint
COPY var/docker/nginx.conf            /etc/nginx/nginx.conf
COPY var/docker/ecosystem.config.cjs  /app/ecosystem.config.cjs
COPY var/docker/entrypoint.sh         /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PATH="/app/node_modules/.bin:${PATH}"

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:5000/ >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
