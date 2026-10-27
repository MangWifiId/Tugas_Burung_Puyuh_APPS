# syntax=docker/dockerfile:1

# ==========================================================
# 1. Build Frontend (React + Vite)
# ==========================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# Base URL API relatif agar UI & API disajikan dari container yang sama.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ==========================================================
# 2. Build Backend (Go)
# ==========================================================
FROM golang:1.27.1-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/api

# ==========================================================
# 3. Runtime Image (ringan, non-root)
# ==========================================================
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata \
	&& addgroup -S app \
	&& adduser -S app -G app

WORKDIR /app

COPY --from=backend-builder /out/server ./server
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /data && chown -R app:app /app /data

USER app

ENV PORT=8080 \
	GIN_MODE=release \
	APP_ENV=production \
	DATA_DIR=/data \
	TZ=Asia/Jakarta

EXPOSE 8080

# Data JSON utama harus dipasang sebagai volume agar tidak hilang saat redeploy.
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
	CMD wget -qO- "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

CMD ["./server"]
