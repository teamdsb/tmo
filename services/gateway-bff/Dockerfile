FROM golang:1.25.6 AS build

WORKDIR /workspace

COPY go.work go.work.sum ./
COPY packages/go-shared ./packages/go-shared
COPY services ./services

RUN cd services/gateway-bff && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/gateway-bff ./cmd/gateway-bff

FROM gcr.io/distroless/base-debian12:nonroot

COPY --from=build /out/gateway-bff /app/gateway-bff

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/gateway-bff"]
