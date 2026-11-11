FROM golang:1.26.11-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o warta-api .

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app

COPY --from=builder /build/warta-api .
COPY --from=builder /build/internal/db/migrations ./internal/db/migrations

EXPOSE 3000
CMD ["./warta-api"]
