FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy dependency dari folder backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy seluruh source code backend
COPY backend/ .

# Build binary Go
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api/main.go

# Production stage
FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/main .

EXPOSE 8080
CMD ["./main"]