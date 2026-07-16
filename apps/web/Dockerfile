# syntax=docker/dockerfile:1
# Context = ROOT repo (monorepo): docker build -f apps/web/Dockerfile .
# ── Stage 1: deps ──────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @ultimate/web...

# ── Stage 2: build ─────────────────────────────────────────────────
FROM deps AS build
COPY packages ./packages
COPY apps/web ./apps/web
ARG NEXT_PUBLIC_MEDIA_HOST
ENV NEXT_PUBLIC_MEDIA_HOST=$NEXT_PUBLIC_MEDIA_HOST
ENV NEXT_TELEMETRY_DISABLED=1
# Build image không có core API: prerender fallback rỗng, ISR chữa lúc runtime.
ENV BUILD_WITHOUT_API=1
ENV NEXT_OUTPUT_STANDALONE=1
RUN pnpm --filter @ultimate/web build

# ── Stage 3: runtime ───────────────────────────────────────────────
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
# standalone chứa server.js + node_modules tối thiểu do Next trace.
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
