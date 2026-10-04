package reconciliation

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/teamdsb/tmo/services/payment/internal/db"
)

const (
	DefaultPollInterval = 2 * time.Second
	DefaultJobTimeout   = 30 * time.Second
	DefaultLease        = 90 * time.Second
)

type Store interface {
	ClaimPaymentReconciliation(context.Context, db.ClaimPaymentReconciliationParams) (db.Payment, error)
	FinishPaymentReconciliation(context.Context, db.FinishPaymentReconciliationParams) (int64, error)
}

type Processor interface {
	ReconcilePayment(context.Context, db.Payment) (db.Payment, error)
}

type Worker struct {
	Store        Store
	Processor    Processor
	QueryB2B     bool
	PollInterval time.Duration
	JobTimeout   time.Duration
	Lease        time.Duration
	Logger       *slog.Logger
}

// Run owns no detached goroutines. Cancellation returns to the service, while
// unacknowledged work remains durable and becomes claimable after its lease.
func (w *Worker) Run(ctx context.Context) error {
	if w == nil || w.Store == nil || w.Processor == nil {
		return errors.New("payment reconciliation dependencies are required")
	}
	if w.lease() < time.Millisecond || w.lease() <= w.timeout() {
		return errors.New("payment reconciliation lease must exceed job timeout")
	}
	poll := w.PollInterval
	if poll <= 0 {
		poll = DefaultPollInterval
	}
	for ctx.Err() == nil {
		processed, err := w.RunNext(ctx)
		if ctx.Err() != nil {
			break
		}
		if err != nil && w.Logger != nil {
			w.Logger.Error("payment reconciliation failed; retry remains scheduled", "error", err)
		}
		if processed && err == nil {
			continue
		}
		timer := time.NewTimer(poll)
		select {
		case <-ctx.Done():
			timer.Stop()
		case <-timer.C:
		}
	}
	return nil
}

func (w *Worker) RunNext(ctx context.Context) (bool, error) {
	if w == nil || w.Store == nil || w.Processor == nil {
		return false, errors.New("payment reconciliation dependencies are required")
	}
	if err := ctx.Err(); err != nil {
		return false, err
	}
	jobCtx, cancel := context.WithTimeout(ctx, w.timeout())
	defer cancel()
	token := uuid.New()
	payment, err := w.Store.ClaimPaymentReconciliation(jobCtx, db.ClaimPaymentReconciliationParams{
		LeaseToken: token, LeaseDurationMs: w.lease().Milliseconds(), QueryB2b: w.QueryB2B,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("claim payment reconciliation: %w", err)
	}
	processed, processErr := w.Processor.ReconcilePayment(jobCtx, payment)
	if processed.ID != payment.ID {
		processed = payment
	}
	if ctx.Err() != nil {
		return true, ctx.Err()
	}
	now := time.Now().UTC()
	delay := pendingInterval(payment.CreatedAt.Time, now)
	var lastError *string
	var attempts int32
	if processErr != nil {
		attempts = payment.ReconcileAttempts
		if attempts < math.MaxInt32 {
			attempts++
		}
		delay = retryInterval(attempts)
		message := []rune(processErr.Error())
		if len(message) > 1000 {
			message = message[:1000]
		}
		value := string(message)
		lastError = &value
	}
	// A provider timeout must not also prevent recording the retry. Bound
	// this acknowledgement separately, but still honor service shutdown.
	finishCtx, finishCancel := context.WithTimeout(ctx, 5*time.Second)
	defer finishCancel()
	_, finishErr := w.Store.FinishPaymentReconciliation(finishCtx, db.FinishPaymentReconciliationParams{
		ID: payment.ID, LeaseToken: token, ObservedVersion: processed.StateVersion,
		RetryAfterMs: delay.Milliseconds(), Attempts: attempts, LastError: lastError,
	})
	if finishErr != nil {
		finishErr = fmt.Errorf("finish payment %s reconciliation: %w", payment.ID, finishErr)
	}
	if processErr != nil {
		processErr = fmt.Errorf("reconcile payment %s: %w", payment.ID, processErr)
	}
	return true, errors.Join(processErr, finishErr)
}

func (w *Worker) timeout() time.Duration {
	if w.JobTimeout > 0 {
		return w.JobTimeout
	}
	return DefaultJobTimeout
}

func (w *Worker) lease() time.Duration {
	if w.Lease > 0 {
		return w.Lease
	}
	return DefaultLease
}

func retryInterval(attempts int32) time.Duration {
	if attempts <= 1 {
		return 10 * time.Second
	}
	if attempts >= 6 {
		return 5 * time.Minute
	}
	return (10 * time.Second) << uint(attempts-1)
}

func pendingInterval(createdAt, now time.Time) time.Duration {
	if now.Sub(createdAt) >= 24*time.Hour {
		return time.Hour
	}
	if now.Sub(createdAt) >= time.Hour {
		return 5 * time.Minute
	}
	return 30 * time.Second
}
