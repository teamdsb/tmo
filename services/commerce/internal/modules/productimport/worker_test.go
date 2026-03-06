package productimport

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

type fakeJobRunner struct {
	mu         sync.Mutex
	resetCalls int
	runCalls   int
	runResults []fakeRunResult
	runSignal  chan struct{}
}

type fakeRunResult struct {
	processed bool
	err       error
}

func (f *fakeJobRunner) ResetStaleRunning(context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.resetCalls++
	return nil
}

func (f *fakeJobRunner) RunNext(context.Context) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.runCalls++
	if f.runSignal != nil {
		select {
		case f.runSignal <- struct{}{}:
		default:
		}
	}
	if len(f.runResults) == 0 {
		return false, nil
	}
	result := f.runResults[0]
	f.runResults = f.runResults[1:]
	return result.processed, result.err
}

func (f *fakeJobRunner) counts() (int, int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.resetCalls, f.runCalls
}

func TestWorkerStartResetsStaleJobsAndRunsImmediately(t *testing.T) {
	runner := &fakeJobRunner{
		runSignal: make(chan struct{}, 4),
		runResults: []fakeRunResult{
			{processed: false, err: nil},
		},
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	worker := &Worker{
		Runner:       runner,
		PollInterval: 5 * time.Millisecond,
	}
	worker.Start(ctx)

	select {
	case <-runner.runSignal:
	case <-time.After(200 * time.Millisecond):
		t.Fatal("expected worker to run at least once")
	}

	cancel()
	time.Sleep(20 * time.Millisecond)

	resetCalls, runCalls := runner.counts()
	if resetCalls != 1 {
		t.Fatalf("expected reset to be called once, got %d", resetCalls)
	}
	if runCalls == 0 {
		t.Fatalf("expected run to be called at least once")
	}
}

func TestWorkerContinuesAfterRunNextError(t *testing.T) {
	runner := &fakeJobRunner{
		runSignal: make(chan struct{}, 8),
		runResults: []fakeRunResult{
			{processed: false, err: errors.New("boom")},
			{processed: false, err: nil},
		},
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	worker := &Worker{
		Runner:       runner,
		PollInterval: 5 * time.Millisecond,
	}
	worker.Start(ctx)

	deadline := time.After(250 * time.Millisecond)
	for {
		_, runCalls := runner.counts()
		if runCalls >= 2 {
			break
		}
		select {
		case <-deadline:
			t.Fatalf("expected worker to continue after error, got %d calls", runCalls)
		case <-time.After(10 * time.Millisecond):
		}
	}
}
