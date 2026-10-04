package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/payment/internal/db"
	"github.com/teamdsb/tmo/services/payment/internal/reconciliation"
)

func TestReconciliationConfirmsB2BAfterClientLeavesAndRetriesCommerce(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := db.New(pool)
	ctx := context.Background()
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	payment, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(orderID, paymentChannelWechatB2B, uuid.NewString(), paymentStatusPending, pgtype.Timestamptz{}))
	if err != nil {
		t.Fatal(err)
	}
	var unavailable atomic.Bool
	unavailable.Store(true)
	var requests atomic.Int32
	commerce := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if unavailable.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		var request CommercePaymentSyncRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil || request.Status != paymentStatusPaid {
			t.Errorf("unexpected sync: %#v err=%v", request, err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer commerce.Close()
	provider := &reconciliationB2BStub{resolution: WechatB2BPaymentResolution{Status: paymentStatusPaid, ProviderTradeNo: "provider-paid-trade"}}
	h := &Handler{Store: queries, Commerce: NewCommerceClient(commerce.URL, "sync-test"), ProviderMode: "b2b", WechatB2B: provider}
	worker := &reconciliation.Worker{Store: queries, Processor: h, QueryB2B: true}
	if processed, err := worker.RunNext(ctx); !processed || err == nil {
		t.Fatalf("expected durable payment with failed Commerce sync: processed=%v err=%v", processed, err)
	}
	stored, err := queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.Status != paymentStatusPaid || stored.StateVersion <= stored.CommerceSyncedVersion || stored.ReconcileLastError == nil || !stored.PaidAt.Valid {
		t.Fatalf("paid state and retry were not persisted: %#v err=%v", stored, err)
	}
	paidAt := stored.PaidAt.Time
	unavailable.Store(false)
	if _, err := pool.Exec(ctx, "UPDATE payments SET reconcile_after = now() WHERE id = $1", payment.ID); err != nil {
		t.Fatal(err)
	}
	// A new worker models a restarted process. Disabling provider creation
	// must not prevent already-paid payments from finishing Commerce sync.
	restarted := &reconciliation.Worker{Store: queries, Processor: &Handler{Store: queries, Commerce: h.Commerce, ProviderMode: "disabled"}}
	if processed, err := restarted.RunNext(ctx); !processed || err != nil {
		t.Fatalf("restart did not repair Commerce: processed=%v err=%v", processed, err)
	}
	stored, err = queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.StateVersion != stored.CommerceSyncedVersion || !stored.PaidAt.Time.Equal(paidAt) {
		t.Fatalf("payment did not converge without changing paidAt: %#v err=%v", stored, err)
	}
	if provider.calls.Load() != 1 || requests.Load() != 2 {
		t.Fatalf("paid retries must only synchronize Commerce: provider=%d commerce=%d", provider.calls.Load(), requests.Load())
	}
}

type reconciliationB2BStub struct {
	calls      atomic.Int32
	resolution WechatB2BPaymentResolution
	err        error
}

func (*reconciliationB2BStub) CreateCommonPayParams(context.Context, WechatB2BPaymentRequest) (map[string]interface{}, error) {
	return nil, nil
}

func (p *reconciliationB2BStub) QueryPayment(context.Context, WechatB2BQueryRequest) (WechatB2BPaymentResolution, error) {
	p.calls.Add(1)
	return p.resolution, p.err
}

func TestReconciliationRetriesQueryErrorsWithoutDroppingPendingSync(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := db.New(pool)
	ctx := context.Background()
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	payment, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(orderID, paymentChannelWechatB2B, uuid.NewString(), paymentStatusPending, pgtype.Timestamptz{}))
	if err != nil {
		t.Fatal(err)
	}
	var syncCount atomic.Int32
	commerce := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { syncCount.Add(1); w.WriteHeader(http.StatusOK) }))
	defer commerce.Close()
	provider := &reconciliationB2BStub{err: errors.New("temporary provider failure")}
	h := &Handler{Store: queries, Commerce: NewCommerceClient(commerce.URL, "sync-test"), ProviderMode: "b2b", WechatB2B: provider}
	worker := &reconciliation.Worker{Store: queries, Processor: h, QueryB2B: true}
	before := time.Now()
	if processed, err := worker.RunNext(ctx); !processed || err == nil {
		t.Fatalf("query error was lost: %v %v", processed, err)
	}
	stored, err := queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.Status != paymentStatusPending || stored.StateVersion != stored.CommerceSyncedVersion || stored.ReconcileAttempts != 1 || !stored.ReconcileAfter.Time.After(before.Add(9*time.Second)) || syncCount.Load() != 1 {
		t.Fatalf("query error blocked sync or lost backoff: %#v sync=%d err=%v", stored, syncCount.Load(), err)
	}
	if processed, err := worker.RunNext(ctx); processed || err != nil {
		t.Fatalf("backoff was ignored: %v %v", processed, err)
	}
	provider.err = nil
	provider.resolution = WechatB2BPaymentResolution{Status: paymentStatusPaid, ProviderTradeNo: "recovered-trade"}
	if _, err := pool.Exec(ctx, "UPDATE payments SET reconcile_after=now() WHERE id=$1", payment.ID); err != nil {
		t.Fatal(err)
	}
	if processed, err := worker.RunNext(ctx); !processed || err != nil {
		t.Fatalf("query retry failed: %v %v", processed, err)
	}
	stored, err = queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.Status != paymentStatusPaid || stored.StateVersion != stored.CommerceSyncedVersion || stored.ReconcileAttempts != 0 || stored.ReconcileLastError != nil {
		t.Fatalf("query recovery did not converge: %#v err=%v", stored, err)
	}
}

func TestReconciliationKeepsNewStateDirtyWhenOldSyncCompletes(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := db.New(pool)
	ctx := context.Background()
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	payment, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(orderID, paymentChannelWechatB2B, uuid.NewString(), paymentStatusPending, pgtype.Timestamptz{}))
	if err != nil {
		t.Fatal(err)
	}
	var calls atomic.Int32
	commerce := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request CommercePaymentSyncRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
			w.WriteHeader(500)
			return
		}
		if calls.Add(1) == 1 {
			if request.Status != paymentStatusPending {
				t.Errorf("first sync=%s", request.Status)
			}
			_, err := queries.UpdatePaymentState(ctx, db.UpdatePaymentStateParams{ID: payment.ID, Status: paymentStatusPaid, PaidAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}})
			if err != nil {
				t.Error(err)
				w.WriteHeader(500)
				return
			}
		} else if request.Status != paymentStatusPaid {
			t.Errorf("second sync=%s", request.Status)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer commerce.Close()
	worker := &reconciliation.Worker{Store: queries, Processor: &Handler{Store: queries, Commerce: NewCommerceClient(commerce.URL, "sync-test"), ProviderMode: "disabled"}}
	if processed, err := worker.RunNext(ctx); !processed || err != nil {
		t.Fatalf("old sync: %v %v", processed, err)
	}
	stored, err := queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.Status != paymentStatusPaid || stored.StateVersion <= stored.CommerceSyncedVersion || stored.ReconcileAfter.Time.After(time.Now()) {
		t.Fatalf("old ack hid newer payment state: %#v err=%v", stored, err)
	}
	if processed, err := worker.RunNext(ctx); !processed || err != nil {
		t.Fatalf("new state sync: %v %v", processed, err)
	}
	stored, err = queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.StateVersion != stored.CommerceSyncedVersion || calls.Load() != 2 {
		t.Fatalf("new state not synchronized: %#v calls=%d err=%v", stored, calls.Load(), err)
	}
}

func TestReconciliationClaimsAreExclusiveAndExpiredLeasesRecover(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := db.New(pool)
	ctx := context.Background()
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	payment, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(orderID, paymentChannelWechatB2B, uuid.NewString(), paymentStatusPending, pgtype.Timestamptz{}))
	if err != nil {
		t.Fatal(err)
	}
	type result struct {
		payment db.Payment
		err     error
		token   uuid.UUID
	}
	results := make(chan result, 2)
	start := make(chan struct{})
	for range 2 {
		go func() {
			<-start
			token := uuid.New()
			p, err := queries.ClaimPaymentReconciliation(ctx, db.ClaimPaymentReconciliationParams{LeaseToken: token, LeaseDurationMs: time.Minute.Milliseconds(), QueryB2b: true})
			results <- result{p, err, token}
		}()
	}
	close(start)
	var winner result
	successes := 0
	for range 2 {
		r := <-results
		if r.err == nil {
			successes++
			winner = r
		} else if !errors.Is(r.err, pgx.ErrNoRows) {
			t.Fatal(r.err)
		}
	}
	if successes != 1 || winner.payment.ID != payment.ID {
		t.Fatalf("two workers claimed same active lease: successes=%d winner=%#v", successes, winner)
	}
	if _, err := pool.Exec(ctx, "UPDATE payments SET reconcile_lease_until=now()-interval '1 second' WHERE id=$1", payment.ID); err != nil {
		t.Fatal(err)
	}
	newToken := uuid.New()
	claimed, err := queries.ClaimPaymentReconciliation(ctx, db.ClaimPaymentReconciliationParams{LeaseToken: newToken, LeaseDurationMs: time.Minute.Milliseconds(), QueryB2b: true})
	if err != nil || claimed.ID != payment.ID {
		t.Fatalf("expired lease was not recovered: %#v %v", claimed, err)
	}
	affected, err := queries.FinishPaymentReconciliation(ctx, db.FinishPaymentReconciliationParams{ID: payment.ID, LeaseToken: winner.token, ObservedVersion: payment.StateVersion, RetryAfterMs: time.Hour.Milliseconds()})
	if err != nil || affected != 0 {
		t.Fatalf("stale worker completed replacement lease: affected=%d err=%v", affected, err)
	}
	stored, err := queries.GetPayment(ctx, payment.ID)
	if err != nil || !stored.ReconcileLeaseToken.Valid || uuid.UUID(stored.ReconcileLeaseToken.Bytes) != newToken {
		t.Fatalf("new lease was overwritten: %#v err=%v", stored, err)
	}
}

func TestReconciliationDoesNotExpireUnconfirmedB2BPayments(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := db.New(pool)
	ctx := context.Background()
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	params := paymentIntegrationCreateParams(orderID, paymentChannelWechatB2B, uuid.NewString(), paymentStatusPending, pgtype.Timestamptz{})
	params.ProviderPayload = json.RawMessage(`{"expiresAt":"2000-01-01T00:00:00Z"}`)
	payment, err := queries.CreatePayment(ctx, params)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE payments SET created_at=now()-interval '2 days' WHERE id=$1", payment.ID); err != nil {
		t.Fatal(err)
	}
	commerce := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))
	defer commerce.Close()
	provider := &reconciliationB2BStub{resolution: WechatB2BPaymentResolution{Status: paymentStatusPending}}
	worker := &reconciliation.Worker{Store: queries, Processor: &Handler{Store: queries, Commerce: NewCommerceClient(commerce.URL, "sync-test"), ProviderMode: "b2b", WechatB2B: provider}, QueryB2B: true}
	if processed, err := worker.RunNext(ctx); !processed || err != nil {
		t.Fatalf("pending query failed: %v %v", processed, err)
	}
	stored, err := queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.Status != paymentStatusPending || stored.ClosedAt.Valid || stored.ReconcileAfter.Time.Before(time.Now().Add(59*time.Minute)) {
		t.Fatalf("worker guessed failure or omitted long-tail polling: %#v err=%v", stored, err)
	}
}

func TestReconciliationMigrationPreservesLeasesAndTracksOldWriters(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := db.New(pool)
	ctx := context.Background()
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	payment, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(orderID, paymentChannelWechatB2B, uuid.NewString(), paymentStatusPending, pgtype.Timestamptz{}))
	if err != nil {
		t.Fatal(err)
	}
	if err := queries.MarkPaymentCommerceSynced(ctx, db.MarkPaymentCommerceSyncedParams{ID: payment.ID, SentVersion: payment.StateVersion}); err != nil {
		t.Fatal(err)
	}
	token := uuid.New()
	claimed, err := queries.ClaimPaymentReconciliation(ctx, db.ClaimPaymentReconciliationParams{LeaseToken: token, LeaseDurationMs: time.Minute.Milliseconds(), QueryB2b: true})
	if err != nil || claimed.ID != payment.ID {
		t.Fatalf("claim: %#v %v", claimed, err)
	}
	if err := db.ApplyMigrations(ctx, pool, filepath.Join("..", "..", "..", "migrations")); err != nil {
		t.Fatal(err)
	}
	stored, err := queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.StateVersion != payment.StateVersion || stored.CommerceSyncedVersion != payment.StateVersion || !stored.ReconcileLeaseToken.Valid || uuid.UUID(stored.ReconcileLeaseToken.Bytes) != token {
		t.Fatalf("migration replay reset scheduling: %#v err=%v", stored, err)
	}
	paidAt := time.Now().UTC().Truncate(time.Microsecond)
	// Simulate an old deployed binary that knows nothing about versions.
	if _, err := pool.Exec(ctx, "UPDATE payments SET status='PAID',paid_at=$2,provider_trade_no='first-trade' WHERE id=$1", payment.ID, paidAt); err != nil {
		t.Fatal(err)
	}
	stored, err = queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.StateVersion != payment.StateVersion+1 || stored.CommerceSyncedVersion != payment.StateVersion {
		t.Fatalf("legacy writer lost pending synchronization: %#v err=%v", stored, err)
	}
	if _, err := pool.Exec(ctx, "UPDATE payments SET status='PAID',paid_at=$2,provider_trade_no='second-trade' WHERE id=$1", payment.ID, paidAt.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE payments SET status='PAY_FAILED',failure_message='late failure',paid_at=NULL,closed_at=now() WHERE id=$1", payment.ID); err != nil {
		t.Fatal(err)
	}
	stored, err = queries.GetPayment(ctx, payment.ID)
	if err != nil || stored.Status != paymentStatusPaid || !stored.PaidAt.Time.Equal(paidAt) || stored.ProviderTradeNo == nil || *stored.ProviderTradeNo != "first-trade" || stored.ClosedAt.Valid || stored.FailureMessage != nil {
		t.Fatalf("late writer changed confirmed payment: %#v err=%v", stored, err)
	}
}

func TestReconciliationMigrationQueuesPreviouslySavedPaidPayments(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	ctx := context.Background()
	schema := "payment_upgrade_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := pool.Exec(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	config := pool.Config().Copy()
	config.ConnConfig.RuntimeParams["search_path"] = schema
	legacyPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		legacyPool.Close()
		if _, err := pool.Exec(context.Background(), "DROP SCHEMA "+quotedSchema+" CASCADE"); err != nil {
			t.Errorf("remove upgrade fixture schema: %v", err)
		}
	})
	oldMigrationDir := t.TempDir()
	oldMigration, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", "00001_create_payments.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(oldMigrationDir, "00001_create_payments.sql"), oldMigration, 0600); err != nil {
		t.Fatal(err)
	}
	if err := db.ApplyMigrations(ctx, legacyPool, oldMigrationDir); err != nil {
		t.Fatal(err)
	}
	paymentID, orderID := uuid.New(), uuid.New()
	if _, err := legacyPool.Exec(ctx, "INSERT INTO payments(id,order_id,channel,status,amount_fen,paid_at) VALUES($1,$2,'WECHAT_B2B','PAID',1234,now())", paymentID, orderID); err != nil {
		t.Fatal(err)
	}
	if err := db.ApplyMigrations(ctx, legacyPool, filepath.Join("..", "..", "..", "migrations")); err != nil {
		t.Fatal(err)
	}
	queries := db.New(legacyPool)
	stored, err := queries.GetPayment(ctx, paymentID)
	if err != nil || stored.StateVersion <= stored.CommerceSyncedVersion {
		t.Fatalf("upgrade did not queue historical paid state: %#v err=%v", stored, err)
	}
	commerce := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request CommercePaymentSyncRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil || request.Status != paymentStatusPaid {
			t.Errorf("historical sync: %#v %v", request, err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer commerce.Close()
	worker := &reconciliation.Worker{Store: queries, Processor: &Handler{Store: queries, Commerce: NewCommerceClient(commerce.URL, "sync-test"), ProviderMode: "disabled"}}
	if processed, err := worker.RunNext(ctx); !processed || err != nil {
		t.Fatalf("historical payment was not repaired: %v %v", processed, err)
	}
	stored, err = queries.GetPayment(ctx, paymentID)
	if err != nil || stored.CommerceSyncedVersion != stored.StateVersion {
		t.Fatalf("historical sync not acknowledged: %#v err=%v", stored, err)
	}
}

func TestReconciliationSuppressesOldNonpaidAcrossChannelsButSendsLatePaid(t *testing.T) {
	pool := openPaymentIntegrationPool(t)
	queries := db.New(pool)
	ctx := context.Background()
	orderID := uuid.New()
	cleanupPaymentIntegrationOrder(t, pool, orderID)
	older, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(orderID, paymentChannelWechatB2B, uuid.NewString(), paymentStatusPending, pgtype.Timestamptz{}))
	if err != nil {
		t.Fatal(err)
	}
	newer, err := queries.CreatePayment(ctx, paymentIntegrationCreateParams(orderID, paymentChannelWechat, uuid.NewString(), paymentStatusFailed, pgtype.Timestamptz{}))
	if err != nil {
		t.Fatal(err)
	}
	var requests atomic.Int32
	commerce := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		var request CommercePaymentSyncRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil || request.PaymentID != older.ID.String() || request.Status != paymentStatusPaid || request.StateVersion <= 0 || request.PaymentCreatedAt == nil || !request.PaymentCreatedAt.Equal(older.CreatedAt.Time) {
			t.Errorf("late paid did not carry ordering evidence: %#v err=%v", request, err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer commerce.Close()
	h := &Handler{Store: queries, Commerce: NewCommerceClient(commerce.URL, "sync-test")}
	if err := h.syncPaymentToCommerce(ctx, older); err != nil {
		t.Fatal(err)
	}
	stored, err := queries.GetPayment(ctx, older.ID)
	if err != nil || stored.CommerceSyncedVersion != stored.StateVersion || requests.Load() != 0 {
		t.Fatalf("superseded nonpaid was sent: %#v requests=%d err=%v", stored, requests.Load(), err)
	}
	latest, err := queries.GetLatestPaymentByOrder(ctx, orderID)
	if err != nil || latest.ID != newer.ID {
		t.Fatalf("latest attempt lookup was channel-scoped: %#v %v", latest, err)
	}
	paid, err := queries.UpdatePaymentState(ctx, db.UpdatePaymentStateParams{ID: older.ID, Status: paymentStatusPaid, PaidAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}})
	if err != nil {
		t.Fatal(err)
	}
	if err := h.syncPaymentToCommerce(ctx, paid); err != nil {
		t.Fatal(err)
	}
	if requests.Load() != 1 {
		t.Fatalf("late Paid from old attempt was suppressed: %d", requests.Load())
	}
}
