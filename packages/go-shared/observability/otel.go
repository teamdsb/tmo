package observability

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

type Config struct {
	ServiceName  string
	Environment  string
	OtelEndpoint string
}

func Setup(ctx context.Context, cfg Config, logger *slog.Logger) (func(context.Context) error, error) {
	exporter, err := newTraceExporter(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if exporter == nil {
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		))
		return func(context.Context) error { return nil }, nil
	}

	attributes := []attribute.KeyValue{}
	if cfg.ServiceName != "" {
		attributes = append(attributes, attribute.String("service.name", cfg.ServiceName))
	}
	if cfg.Environment != "" {
		attributes = append(attributes, attribute.String("deployment.environment", cfg.Environment))
	}

	res, err := resource.New(ctx, resource.WithFromEnv(), resource.WithAttributes(attributes...))
	if err != nil {
		return nil, err
	}

	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	if logger != nil {
		logger.Info("otel tracing enabled")
	}

	return provider.Shutdown, nil
}

func newTraceExporter(ctx context.Context, cfg Config) (*otlptrace.Exporter, error) {
	if strings.EqualFold(os.Getenv("OTEL_TRACES_EXPORTER"), "none") {
		return nil, nil
	}
	if !shouldEnableOTel(cfg) {
		return nil, nil
	}
	if exporter := strings.TrimSpace(os.Getenv("OTEL_TRACES_EXPORTER")); exporter != "" && !strings.EqualFold(exporter, "otlp") {
		return nil, fmt.Errorf("unsupported OTEL_TRACES_EXPORTER=%q", exporter)
	}

	protocol := firstNonEmpty(
		os.Getenv("OTEL_EXPORTER_OTLP_TRACES_PROTOCOL"),
		os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"),
	)
	if protocol == "" {
		protocol = "grpc"
	}
	protocol = strings.ToLower(protocol)

	endpoint := firstNonEmpty(
		cfg.OtelEndpoint,
		os.Getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"),
		os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
	)

	headers := parseHeaders(firstNonEmpty(
		os.Getenv("OTEL_EXPORTER_OTLP_TRACES_HEADERS"),
		os.Getenv("OTEL_EXPORTER_OTLP_HEADERS"),
	))

	insecure, insecureSet := parseBoolEnv(
		"OTEL_EXPORTER_OTLP_TRACES_INSECURE",
		"OTEL_EXPORTER_OTLP_INSECURE",
	)

	endpointHost, endpointPath, endpointInsecure := normalizeEndpoint(endpoint)
	if endpointHost != "" {
		endpoint = endpointHost
	}
	if !insecureSet && endpointInsecure {
		insecure = true
	}

	switch protocol {
	case "grpc":
		options := []otlptracegrpc.Option{}
		if endpoint != "" {
			options = append(options, otlptracegrpc.WithEndpoint(endpoint))
		}
		if insecure {
			options = append(options, otlptracegrpc.WithInsecure())
		}
		if len(headers) > 0 {
			options = append(options, otlptracegrpc.WithHeaders(headers))
		}
		return otlptracegrpc.New(ctx, options...)
	case "http", "http/protobuf", "http/proto", "http-json", "http/json":
		options := []otlptracehttp.Option{}
		if endpoint != "" {
			options = append(options, otlptracehttp.WithEndpoint(endpoint))
		}
		if endpointPath != "" {
			options = append(options, otlptracehttp.WithURLPath(endpointPath))
		}
		if insecure {
			options = append(options, otlptracehttp.WithInsecure())
		}
		if len(headers) > 0 {
			options = append(options, otlptracehttp.WithHeaders(headers))
		}
		return otlptracehttp.New(ctx, options...)
	default:
		return nil, fmt.Errorf("unsupported OTLP protocol %q", protocol)
	}
}

func shouldEnableOTel(cfg Config) bool {
	if cfg.OtelEndpoint != "" {
		return true
	}
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != "" || os.Getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") != "" {
		return true
	}
	if os.Getenv("OTEL_TRACES_EXPORTER") != "" {
		return true
	}
	if os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL") != "" || os.Getenv("OTEL_EXPORTER_OTLP_TRACES_PROTOCOL") != "" {
		return true
	}
	return false
}

func parseHeaders(raw string) map[string]string {
	if raw == "" {
		return nil
	}

	parsed := map[string]string{}
	pairs := strings.Split(raw, ",")
	for _, pair := range pairs {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if key == "" {
			continue
		}
		parsed[key] = value
	}
	if len(parsed) == 0 {
		return nil
	}
	return parsed
}

func parseBoolEnv(keys ...string) (bool, bool) {
	for _, key := range keys {
		raw := strings.TrimSpace(os.Getenv(key))
		if raw == "" {
			continue
		}
		value, err := strconv.ParseBool(raw)
		if err != nil {
			continue
		}
		return value, true
	}
	return false, false
}

func normalizeEndpoint(raw string) (string, string, bool) {
	if raw == "" || !strings.Contains(raw, "://") {
		return raw, "", false
	}

	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return raw, "", false
	}

	endpoint := parsed.Host
	path := strings.TrimSpace(parsed.Path)
	insecure := strings.EqualFold(parsed.Scheme, "http")

	return endpoint, path, insecure
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
