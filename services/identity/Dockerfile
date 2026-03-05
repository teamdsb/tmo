FROM golang:1.25 AS build

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

RUN cd services/identity && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/identity ./cmd/identity

FROM gcr.io/distroless/base-debian12:nonroot

COPY --from=build /out/identity /app/identity

USER nonroot:nonroot
EXPOSE 8081
ENTRYPOINT ["/app/identity"]
