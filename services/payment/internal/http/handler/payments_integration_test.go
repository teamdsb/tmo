package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	paymentdb "github.com/teamdsb/tmo/services/payment/internal/db"
)

func TestApplyPaymentResolutionPostgresKeepsPaidStateMonotonic(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := paymentdb.New(pool)
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	paidAt := time.Now().UTC().Truncate(time.Microsecond)
	stored, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(
		orderID,
		"WECHAT",
		"postgres-paid-monotonic",
		paymentStatusPaid,
		pgtype.Timestamptz{Time: paidAt, Valid: true},
	))
	if err != nil {
		t.Fatalf("create PAID payment: %v", err)
	}

	stale := stored
	stale.Status = paymentStatusPending
	stale.PaidAt = pgtype.Timestamptz{}
	store := &recordingPaymentQueries{Queries: queries}
	handler := &Handler{Store: store}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/payments/"+stored.ID.String()+"/recheck", nil).WithContext(ctx)
	reason := "late provider failure"

	updated, err := handler.applyPaymentResolution(c, stale, paymentStatusFailed, nil, &reason)
	if err != nil {
		t.Fatalf("resolve stale failure against PAID row: %v", err)
	}
	if !errors.Is(store.updateErr, pgx.ErrNoRows) {
		t.Fatalf("expected conditional update conflict to return pgx.ErrNoRows, got %v", store.updateErr)
	}
	if updated.Status != paymentStatusPaid {
		t.Fatalf("expected handler to reload PAID row, got %s", updated.Status)
	}

	current, err := queries.GetPayment(ctx, stored.ID)
	if err != nil {
		t.Fatalf("reload payment: %v", err)
	}
	if current.Status != paymentStatusPaid {
		t.Fatalf("PAID payment was downgraded in PostgreSQL: %s", current.Status)
	}
	if !current.PaidAt.Valid || !current.PaidAt.Time.Equal(stored.PaidAt.Time) {
		t.Fatalf("paidAt changed after rejected downgrade: got %#v want %#v", current.PaidAt, stored.PaidAt)
	}
	if current.FailureCode != nil || current.FailureMessage != nil || current.ClosedAt.Valid {
		t.Fatalf("rejected downgrade wrote failure fields: %#v", current)
	}
}

func TestCreatePaymentPostgresConcurrentIdempotencyWinnerIsReloadable(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	connections := make([]*pgxpool.Conn, 2)
	for index := range connections {
		connection, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatalf("acquire PostgreSQL connection %d: %v", index+1, err)
		}
		connections[index] = connection
		defer connection.Release()
	}

	const idempotencyKey = "postgres-concurrent-idempotency"
	start := make(chan struct{})
	results := make(chan concurrentPaymentCreateResult, len(connections))
	for _, connection := range connections {
		queries := paymentdb.New(connection)
		go func() {
			<-start
			created, createErr := queries.CreatePayment(ctx, paymentIntegrationCreateParams(
				orderID,
				"WECHAT",
				idempotencyKey,
				paymentStatusPending,
				pgtype.Timestamptz{},
			))
			result := concurrentPaymentCreateResult{created: created, createErr: createErr}
			if shareddb.IsUniqueViolation(createErr) {
				result.reloaded, result.reloadErr = queries.GetPaymentByIdempotencyKey(ctx, paymentdb.GetPaymentByIdempotencyKeyParams{
					OrderID:        orderID,
					Channel:        paymentChannelWechat,
					IdempotencyKey: paymentIntegrationStringPtr(idempotencyKey),
				})
			}
			results <- result
		}()
	}
	close(start)

	var winner paymentdb.Payment
	successes := 0
	uniqueViolations := 0
	var loserReload paymentdb.Payment
	for range connections {
		result := <-results
		switch {
		case result.createErr == nil:
			successes++
			winner = result.created
		case shareddb.IsUniqueViolation(result.createErr):
			uniqueViolations++
			var pgErr *pgconn.PgError
			if !errors.As(result.createErr, &pgErr) || pgErr.ConstraintName != "payments_order_channel_idempotency_idx" {
				t.Fatalf("unexpected unique violation: %v", result.createErr)
			}
			if result.reloadErr != nil {
				t.Fatalf("reload winner after unique violation: %v", result.reloadErr)
			}
			loserReload = result.reloaded
		default:
			t.Fatalf("unexpected concurrent insert error: %v", result.createErr)
		}
	}

	if successes != 1 || uniqueViolations != 1 {
		t.Fatalf("expected one winner and one unique violation, got successes=%d uniqueViolations=%d", successes, uniqueViolations)
	}
	if loserReload.ID != winner.ID {
		t.Fatalf("race loser reloaded payment %s, want winner %s", loserReload.ID, winner.ID)
	}

	var rowCount int64
	if err := pool.QueryRow(ctx, `
		SELECT count(*)
		FROM payments
		WHERE order_id = $1 AND channel = $2 AND idempotency_key = $3
	`, orderID, paymentChannelWechat, idempotencyKey).Scan(&rowCount); err != nil {
		t.Fatalf("count idempotent payment rows: %v", err)
	}
	if rowCount != 1 {
		t.Fatalf("expected exactly one persisted payment, got %d", rowCount)
	}
}

type recordingPaymentQueries struct {
	*paymentdb.Queries
	updateErr error
}

func (q *recordingPaymentQueries) UpdatePaymentState(ctx context.Context, arg paymentdb.UpdatePaymentStateParams) (paymentdb.Payment, error) {
	payment, err := q.Queries.UpdatePaymentState(ctx, arg)
	q.updateErr = err
	return payment, err
}

type concurrentPaymentCreateResult struct {
	created   paymentdb.Payment
	createErr error
	reloaded  paymentdb.Payment
	reloadErr error
}

func openPaymentIntegrationPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := strings.TrimSpace(os.Getenv("PAYMENT_DB_DSN"))
	requiredRaw := strings.TrimSpace(os.Getenv("PAYMENT_INTEGRATION_REQUIRED"))
	required := false
	if requiredRaw != "" {
		parsed, err := strconv.ParseBool(requiredRaw)
		if err != nil {
			t.Fatalf("PAYMENT_INTEGRATION_REQUIRED must be a boolean: %v", err)
		}
		required = parsed
	}
	if dsn == "" {
		if required {
			t.Fatal("PAYMENT_DB_DSN is required when PAYMENT_INTEGRATION_REQUIRED=true")
		}
		t.Skip("PAYMENT_DB_DSN is not set; skipping Payment PostgreSQL integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("parse PAYMENT_DB_DSN: %v", err)
	}
	if poolConfig.MaxConns < 2 {
		poolConfig.MaxConns = 2
	}
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		t.Fatalf("connect to Payment PostgreSQL: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Fatalf("ping Payment PostgreSQL: %v", err)
	}
	if err := paymentdb.ApplyMigrations(ctx, pool, filepath.Join("..", "..", "..", "migrations")); err != nil {
		pool.Close()
		t.Fatalf("apply Payment migrations: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func cleanupPaymentIntegrationOrder(t *testing.T, pool *pgxpool.Pool, orderID uuid.UUID) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := pool.Exec(ctx, "DELETE FROM payments WHERE order_id = $1", orderID); err != nil {
			t.Errorf("clean Payment integration fixture: %v", err)
		}
	})
}

func paymentIntegrationCreateParams(orderID uuid.UUID, channel, idempotencyKey, status string, paidAt pgtype.Timestamptz) paymentdb.CreatePaymentParams {
	return paymentdb.CreatePaymentParams{
		OrderID:         orderID,
		Channel:         channel,
		Status:          status,
		AmountFen:       1234,
		Currency:        "CNY",
		IdempotencyKey:  paymentIntegrationStringPtr(idempotencyKey),
		ProviderPayload: json.RawMessage(`{"source":"postgres-integration"}`),
		PaidAt:          paidAt,
	}
}

func paymentIntegrationStringPtr(value string) *string {
	return &value
}
