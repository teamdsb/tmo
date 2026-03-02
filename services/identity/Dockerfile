FROM golang:1.25 AS build

WORKDIR /workspace

COPY go.work go.work.sum ./
COPY packages/go-shared ./packages/go-shared
COPY services ./services

RUN cd services/identity && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/identity ./cmd/identity && \
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/identity-migrate ./cmd/identity-migrate

FROM alpine:3.20

RUN apk add --no-cache ca-certificates && \
	addgroup -S app && \
	adduser -S -G app app

COPY --from=build /out/identity /app/identity
COPY --from=build /out/identity-migrate /app/identity-migrate
COPY --from=build /workspace/services/identity/migrations /app/migrations

WORKDIR /app
USER app
EXPOSE 8081
ENTRYPOINT ["/app/identity"]
