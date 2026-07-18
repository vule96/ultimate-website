# syntax=docker/dockerfile:1
# Context = ROOT repo (monorepo): docker build -f apps/admin/Dockerfile .
# ── Stage 1: build (Vite → static assets) ──────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @ultimate/admin...
COPY packages ./packages
COPY apps/admin ./apps/admin
# VITE_* nướng vào bundle lúc build (SPA static).
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @ultimate/admin build

# ── Stage 2: runtime (nginx serve static) ──────────────────────────
# nginx-unprivileged: chạy uid 101 (non-root, thoả DS-0002), listen 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
# uid 101 = nginx trong base unprivileged; khai báo tường minh để thoả DS-0002.
USER 101
EXPOSE 8080
