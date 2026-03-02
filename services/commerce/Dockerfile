FROM golang:1.25 AS build

WORKDIR /workspace

COPY go.work go.work.sum ./
COPY packages/go-shared ./packages/go-shared
COPY services ./services

RUN cd services/commerce && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/commerce ./cmd/commerce && \
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/commerce-migrate ./cmd/commerce-migrate

FROM alpine:3.20

RUN apk add --no-cache ca-certificates && \
	addgroup -S app && \
	adduser -S -G app app

COPY --from=build /out/commerce /app/commerce
COPY --from=build /out/commerce-migrate /app/commerce-migrate
COPY --from=build /workspace/services/commerce/migrations /app/migrations

WORKDIR /app
USER app
EXPOSE 8080
ENTRYPOINT ["/app/commerce"]
