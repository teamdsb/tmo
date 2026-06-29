ARG DOCKERHUB_MIRROR_PREFIX=
FROM ${DOCKERHUB_MIRROR_PREFIX}golang:1.26-alpine AS build

WORKDIR /workspace

ARG GOPROXY=https://proxy.golang.org,direct
ARG GOSUMDB=sum.golang.org
ARG GONOSUMDB=

ENV GOPROXY="${GOPROXY}" \
    GOSUMDB="${GOSUMDB}" \
    GONOSUMDB="${GONOSUMDB}"

COPY go.work go.work.sum ./
COPY packages/go-shared ./packages/go-shared
COPY services ./services

RUN cd services/payment && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/payment ./cmd/payment

ARG GCR_MIRROR_PREFIX=
FROM ${DOCKERHUB_MIRROR_PREFIX}alpine:3.20
RUN apk add --no-cache ca-certificates

COPY --from=build /out/payment /app/payment
COPY --from=build /workspace/services/payment/migrations /app/migrations

USER nobody:nobody
EXPOSE 8083
WORKDIR /app
ENTRYPOINT ["/app/payment"]
