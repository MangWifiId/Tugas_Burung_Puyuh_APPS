
# Build stage
FROM golang:1.27.1-alpine AS builder

WORKDIR /app

# Salin file dependency backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Salin kode backend
COPY backend/ .

# Kompilasi aplikasi
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api

# Production stage
FROM alpine:latest

WORKDIR /root/

# Sertifikat untuk koneksi HTTPS/TLS
RUN apk --no-cache add ca-certificates

COPY --from=builder /app/main ./main

EXPOSE 8080

CMD ["./main"]
