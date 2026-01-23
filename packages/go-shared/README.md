# go-shared

Shared Go infrastructure used by services in this repo.

## Packages

- `config`: environment helpers for string, int, bool, and duration.
- `db`: pgxpool defaults, readiness check, transactions, and Postgres error helpers.
- `errors`: JSON API error writer for Gin.
- `httpx`: Gin router helpers and middleware (request id, access log, recovery, health/ready).
- `money`: currency helpers for fen-based pricing (int64).
- `observability`: OpenTelemetry trace setup via OTLP (gRPC/HTTP), no-op when not configured.

## Usage

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
pool, _ := db.NewPool(ctx, dsn)

router := httpx.NewRouter(
	httpx.WithLogger(logger),
	httpx.WithOtel("commerce"),
)
router.GET("/health", httpx.Health())
router.GET("/ready", httpx.Ready(func(ctx context.Context) error {
	return db.Ready(ctx, pool)
}))

server := httpx.NewServer(":8080", router)
_ = server.ListenAndServe()
```

## OTel configuration

Tracing is enabled only when you set standard OTLP environment variables, such as:

- `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL` or `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL` (`grpc` or `http`)
- `OTEL_EXPORTER_OTLP_HEADERS` or `OTEL_EXPORTER_OTLP_TRACES_HEADERS`
- `OTEL_EXPORTER_OTLP_INSECURE` or `OTEL_EXPORTER_OTLP_TRACES_INSECURE`

Set `OTEL_TRACES_EXPORTER=none` to explicitly disable tracing.

## Tests

```bash
cd packages/go-shared
go test ./...
```
