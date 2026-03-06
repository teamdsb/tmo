package productimport

import (
	"context"
	"errors"
	"log/slog"
	"time"
)

const defaultPollInterval = 2 * time.Second

type jobRunner interface {
	ResetStaleRunning(ctx context.Context) error
	RunNext(ctx context.Context) (bool, error)
}

type Worker struct {
	Runner       jobRunner
	PollInterval time.Duration
	Logger       *slog.Logger
}

func (w *Worker) Start(ctx context.Context) {
	if w == nil || w.Runner == nil {
		return
	}

	pollInterval := w.PollInterval
	if pollInterval <= 0 {
		pollInterval = defaultPollInterval
	}

	if err := w.Runner.ResetStaleRunning(ctx); err != nil {
		w.logError("reset stale product import jobs failed", err)
	}

	go func() {
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()

		for {
			if ctx.Err() != nil {
				return
			}
			processed, err := w.Runner.RunNext(ctx)
			if err != nil && !errors.Is(err, context.Canceled) {
				w.logError("run product import job failed", err)
			}
			if processed {
				continue
			}

			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func (w *Worker) logError(message string, err error) {
	if w == nil || w.Logger == nil {
		return
	}
	w.Logger.Error(message, "error", err)
}
