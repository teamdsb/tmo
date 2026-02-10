FROM golang:1.25 AS build

WORKDIR /workspace

COPY go.work go.work.sum ./
COPY packages/go-shared ./packages/go-shared
COPY services ./services

RUN cd services/commerce && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/commerce ./cmd/commerce

FROM gcr.io/distroless/base-debian12:nonroot

COPY --from=build /out/commerce /app/commerce

USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/commerce"]
