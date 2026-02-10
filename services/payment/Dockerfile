FROM golang:1.25 AS build

WORKDIR /workspace

COPY go.work go.work.sum ./
COPY packages/go-shared ./packages/go-shared
COPY services ./services

RUN cd services/payment && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -trimpath -ldflags "-s -w" -o /out/payment ./cmd/payment

FROM gcr.io/distroless/base-debian12:nonroot

COPY --from=build /out/payment /app/payment

USER nonroot:nonroot
EXPOSE 8083
ENTRYPOINT ["/app/payment"]
