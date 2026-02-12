package scheduler

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/blueprinter/worker/internal/db/dbgen"
)

const (
	pollInterval = 30 * time.Second
	maxConcurrent = 5
)

// Scheduler polls the database for due watches and executes them concurrently.
type Scheduler struct {
	executor *Executor
	queries  *dbgen.Queries
	logger   *slog.Logger
}

// NewScheduler creates a new Scheduler.
func NewScheduler(executor *Executor, queries *dbgen.Queries, logger *slog.Logger) *Scheduler {
	return &Scheduler{
		executor: executor,
		queries:  queries,
		logger:   logger,
	}
}

// Run starts the polling loop. It blocks until the context is cancelled.
func (s *Scheduler) Run(ctx context.Context) {
	s.logger.Info("scheduler started", "poll_interval", pollInterval, "max_concurrent", maxConcurrent)
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	// Run once immediately on startup
	s.poll(ctx)

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("scheduler stopping")
			return
		case <-ticker.C:
			s.poll(ctx)
		}
	}
}

func (s *Scheduler) poll(ctx context.Context) {
	watches, err := s.queries.GetDueWatches(ctx)
	if err != nil {
		s.logger.Error("failed to get due watches", "error", err)
		return
	}

	if len(watches) == 0 {
		return
	}

	s.logger.Info("found due watches", "count", len(watches))

	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for _, w := range watches {
		wg.Add(1)
		sem <- struct{}{}
		go func(watch dbgen.GetDueWatchesRow) {
			defer wg.Done()
			defer func() { <-sem }()
			s.executor.Execute(ctx, watch)
		}(w)
	}

	wg.Wait()
}

// RunSingle executes a single watch by ID (for manual trigger endpoint).
func (s *Scheduler) RunSingle(ctx context.Context, watchID string) (string, error) {
	return s.executor.ExecuteByID(ctx, watchID)
}
