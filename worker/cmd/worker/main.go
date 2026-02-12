package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/blueprinter/worker/internal/api"
	"github.com/blueprinter/worker/internal/blueprint"
	"github.com/blueprinter/worker/internal/config"
	"github.com/blueprinter/worker/internal/db"
	"github.com/blueprinter/worker/internal/db/dbgen"
	"github.com/blueprinter/worker/internal/fetcher"
	"github.com/blueprinter/worker/internal/scheduler"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(logger); err != nil {
		logger.Error("fatal error", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Database
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}
	defer pool.Close()
	logger.Info("database connected")

	queries := dbgen.New(pool)

	// External clients
	fetcherClient, err := fetcher.NewClient(cfg.FirecrawlAPIKey, logger)
	if err != nil {
		return fmt.Errorf("creating fetcher client: %w", err)
	}

	openaiClient := blueprint.NewOpenAIClient(cfg.OpenAIAPIKey, cfg.OpenAIModel, logger)

	// Scheduler
	executor := scheduler.NewExecutor(queries, fetcherClient, logger)
	sched := scheduler.NewScheduler(executor, queries, logger)

	// HTTP server
	handlers := api.NewHandlers(fetcherClient, openaiClient, sched, logger)
	srv := api.NewServer(cfg.Port, cfg.WorkerAPIKey, handlers, logger)

	errCh := make(chan error, 1)

	// Start scheduler in background
	go sched.Run(ctx)

	// Start HTTP server
	go func() {
		logger.Info("worker starting", "port", cfg.Port)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			return fmt.Errorf("server error: %w", err)
		}
	case <-ctx.Done():
		logger.Info("shutting down...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown error: %w", err)
		}
	}

	logger.Info("worker stopped")
	return nil
}
