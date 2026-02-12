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
	"github.com/blueprinter/worker/internal/fetcher"
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

	fetcherClient, err := fetcher.NewClient(cfg.FirecrawlAPIKey, logger)
	if err != nil {
		return fmt.Errorf("creating fetcher client: %w", err)
	}

	openaiClient := blueprint.NewOpenAIClient(cfg.OpenAIAPIKey, cfg.OpenAIModel, logger)

	handlers := api.NewHandlers(fetcherClient, openaiClient, logger)
	srv := api.NewServer(cfg.Port, cfg.WorkerAPIKey, handlers, logger)

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
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
