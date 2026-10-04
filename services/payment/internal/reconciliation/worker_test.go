package reconciliation

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/teamdsb/tmo/services/payment/internal/db"
)

func TestWorkerCancellationStopsAnInFlightProvider(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	started := make(chan struct{})
	store := &workerStoreStub{payment: db.Payment{ID: uuid.New(), StateVersion: 1}}
	processor := processorFunc(func(ctx context.Context, p db.Payment) (db.Payment, error) {
		close(started)
		<-ctx.Done()
		return p, ctx.Err()
	})
	w := &Worker{Store: store, Processor: processor, PollInterval: time.Hour}
	done := make(chan error, 1)
	go func() { done <- w.Run(ctx) }()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("worker did not start")
	}
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("worker did not stop on cancellation")
	}
	if store.finishes.Load() != 0 {
		t.Fatal("shutdown falsely completed a cancelled task")
	}
}

func TestWorkerPersistsRetryAfterProcessingDeadline(t *testing.T) {
	store := &workerStoreStub{payment: db.Payment{ID: uuid.New(), StateVersion: 1}}
	processor := processorFunc(func(ctx context.Context, p db.Payment) (db.Payment, error) { <-ctx.Done(); return p, ctx.Err() })
	w := &Worker{Store: store, Processor: processor, JobTimeout: 5 * time.Millisecond, Lease: time.Second}
	processed, err := w.RunNext(context.Background())
	if !processed || !errors.Is(err, context.DeadlineExceeded) || store.finishes.Load() != 1 || store.finishCtxErr != nil || store.lastFinish.Attempts != 1 {
		t.Fatalf("deadline lost durable retry: processed=%v err=%v finish=%#v finishContext=%v", processed, err, store.lastFinish, store.finishCtxErr)
	}
}

func TestRetryIntervalsStayBounded(t *testing.T) {
	for _, n := range []int32{1, 2, 5, 6, 1000000} {
		d := retryInterval(n)
		if d < 10*time.Second || d > 5*time.Minute {
			t.Fatalf("invalid backoff at %d: %s", n, d)
		}
	}
}

type processorFunc func(context.Context, db.Payment) (db.Payment, error)

func (f processorFunc) ReconcilePayment(c context.Context, p db.Payment) (db.Payment, error) {
	return f(c, p)
}

type workerStoreStub struct {
	payment      db.Payment
	claimed      atomic.Bool
	finishes     atomic.Int32
	finishCtxErr error
	lastFinish   db.FinishPaymentReconciliationParams
}

func (s *workerStoreStub) ClaimPaymentReconciliation(context.Context, db.ClaimPaymentReconciliationParams) (db.Payment, error) {
	if s.claimed.Swap(true) {
		return db.Payment{}, pgx.ErrNoRows
	}
	return s.payment, nil
}
func (s *workerStoreStub) FinishPaymentReconciliation(ctx context.Context, p db.FinishPaymentReconciliationParams) (int64, error) {
	s.finishes.Add(1)
	s.finishCtxErr = ctx.Err()
	s.lastFinish = p
	return 1, nil
}
