# syntax=docker/dockerfile:1
# ── Stage 1: build ─────────────────────────────────────────────────
FROM golang:1.25-alpine AS build
WORKDIR /src

# Cache go mod theo layer — đổi code không phải tải lại deps.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
ARG GIT_SHA=dev
# CGO off → binary tĩnh chạy được trên distroless/static; -s -w bỏ symbol table.
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${GIT_SHA}" \
    -o /out/api ./cmd/api && \
    CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" \
    -o /out/blurhash-backfill ./cmd/blurhash-backfill

# ── Stage 2: runtime ───────────────────────────────────────────────
# distroless/static: không shell, không package manager — bề mặt tấn công tối thiểu.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
COPY --from=build /out/blurhash-backfill /blurhash-backfill
# Base :nonroot đã chạy uid 65532; khai báo tường minh để thoả DS-0002 (Trivy).
USER nonroot:nonroot
EXPOSE 8080 9091
ENTRYPOINT ["/api"]
