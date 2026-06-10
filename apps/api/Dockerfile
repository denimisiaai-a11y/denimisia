# ── Denimisia API — multi-stage production image ──────────────────────────────
# Build once, run lean. Final image is node:20-alpine + built artifact only.
# No source, no dev deps, no tests. Non-root user. Runs under tini for proper
# signal forwarding so /ready probes can flip to degraded on SIGTERM.

# ── 1. deps stage — install production deps against the monorepo ───────────────
FROM node:26-alpine AS deps
WORKDIR /repo

RUN apk add --no-cache libc6-compat ffmpeg

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json ./
COPY apps/api/package.json                apps/api/
COPY packages/database/package.json        packages/database/

RUN npm i -g pnpm@10 && pnpm install --frozen-lockfile --prod=false

# ── 2. build stage — compile TS + generate Prisma client ───────────────────────
FROM deps AS build
WORKDIR /repo
COPY . .
RUN pnpm --filter database prisma generate && pnpm --filter api build

# Prune dev dependencies for runtime.
RUN pnpm --filter api --prod deploy /app

# ── 3. runtime stage ──────────────────────────────────────────────────────────
FROM node:26-alpine AS runtime
WORKDIR /app

# ffmpeg is required for video transcoding in the media module.
RUN apk add --no-cache ffmpeg tini && \
    addgroup -S denim && adduser -S denim -G denim && \
    chown -R denim:denim /app

COPY --from=build --chown=denim:denim /app /app

USER denim
ENV NODE_ENV=production PORT=3001
EXPOSE 3001

# Healthcheck — liveness only; keep it cheap so it doesn't touch DB.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
