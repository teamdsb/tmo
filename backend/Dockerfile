FROM golang:1.25.5-alpine

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN go build -o server ./cmd/server

EXPOSE 8080

CMD ["/app/server"]
