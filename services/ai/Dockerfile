FROM golang:1.26 AS build

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
COPY contracts ./contracts

RUN cd services/ai && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/ai ./cmd/ai

FROM gcr.io/distroless/base-debian12:nonroot

COPY --from=build /out/ai /app/ai

USER nonroot:nonroot
EXPOSE 8084
ENTRYPOINT ["/app/ai"]
