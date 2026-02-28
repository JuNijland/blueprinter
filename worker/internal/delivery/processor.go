package delivery

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/blueprinter/worker/internal/db/dbgen"
)

const (
	pollInterval  = 10 * time.Second
	maxConcurrent = 3
)

// Retry backoff durations: 1m, 5m, 30m, 2h.
var retryBackoffs = []time.Duration{
	1 * time.Minute,
	5 * time.Minute,
	30 * time.Minute,
	2 * time.Hour,
}

// Processor polls for pending deliveries and sends them.
type Processor struct {
	queries *dbgen.Queries
	sender  Sender
	logger  *slog.Logger
}

// NewProcessor creates a new delivery Processor.
func NewProcessor(queries *dbgen.Queries, sender Sender, logger *slog.Logger) *Processor {
	return &Processor{
		queries: queries,
		sender:  sender,
		logger:  logger,
	}
}

// Run starts the polling loop. It blocks until the context is cancelled.
func (p *Processor) Run(ctx context.Context) {
	p.logger.Info("delivery processor started", "poll_interval", pollInterval, "max_concurrent", maxConcurrent)
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	// Run once immediately on startup
	p.poll(ctx)

	for {
		select {
		case <-ctx.Done():
			p.logger.Info("delivery processor stopping")
			return
		case <-ticker.C:
			p.poll(ctx)
		}
	}
}

func (p *Processor) poll(ctx context.Context) {
	deliveries, err := p.queries.GetPendingDeliveries(ctx)
	if err != nil {
		p.logger.Error("failed to get pending deliveries", "error", err)
		return
	}

	if len(deliveries) == 0 {
		return
	}

	p.logger.Info("found pending deliveries", "count", len(deliveries))

	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for i := range deliveries {
		wg.Add(1)
		sem <- struct{}{}
		go func(d *dbgen.GetPendingDeliveriesRow) {
			defer wg.Done()
			defer func() { <-sem }()
			p.processDelivery(ctx, d)
		}(&deliveries[i])
	}

	wg.Wait()
}

func (p *Processor) processDelivery(ctx context.Context, d *dbgen.GetPendingDeliveriesRow) {
	// Parse channel config to get recipients
	var config struct {
		To []string `json:"to"`
	}
	if err := json.Unmarshal(d.ChannelConfig, &config); err != nil {
		p.markFailed(ctx, d, fmt.Errorf("parsing channel config: %w", err))
		return
	}

	if len(config.To) == 0 {
		p.markFailed(ctx, d, fmt.Errorf("no recipients in channel config"))
		return
	}

	// Build email content
	subject, htmlBody, err := BuildEmailContent(d.EventType, d.EventPayload, d.SubscriptionName)
	if err != nil {
		p.markFailed(ctx, d, fmt.Errorf("building email content: %w", err))
		return
	}

	// Send email
	err = p.sender.Send(ctx, SendRequest{
		To:       config.To,
		Subject:  subject,
		HTMLBody: htmlBody,
	})
	if err != nil {
		p.handleSendError(ctx, d, err)
		return
	}

	// Success
	if err := p.queries.MarkDeliveryDelivered(ctx, d.ID); err != nil {
		p.logger.Error("failed to mark delivery as delivered",
			"delivery_id", d.ID,
			"error", err,
		)
		return
	}

	p.logger.Info("delivery sent",
		"delivery_id", d.ID,
		"event_type", d.EventType,
		"subscription", d.SubscriptionName,
		"recipients", config.To,
	)
}

func (p *Processor) handleSendError(ctx context.Context, d *dbgen.GetPendingDeliveriesRow, sendErr error) {
	nextAttempt := d.Attempts + 1 // attempts will be incremented by the query

	// If we've exhausted retries, mark as failed
	if int(nextAttempt) >= int(d.MaxAttempts) {
		p.markFailed(ctx, d, sendErr)
		return
	}

	// Calculate next retry time
	backoffIdx := int(d.Attempts)
	if backoffIdx >= len(retryBackoffs) {
		backoffIdx = len(retryBackoffs) - 1
	}
	nextRetry := time.Now().Add(retryBackoffs[backoffIdx])

	if err := p.queries.MarkDeliveryRetry(ctx, dbgen.MarkDeliveryRetryParams{
		ID: d.ID,
		NextRetryAt: pgtype.Timestamptz{
			Time:  nextRetry,
			Valid: true,
		},
		LastError: pgtype.Text{
			String: sendErr.Error(),
			Valid:  true,
		},
	}); err != nil {
		p.logger.Error("failed to mark delivery for retry",
			"delivery_id", d.ID,
			"error", err,
		)
		return
	}

	p.logger.Warn("delivery failed, scheduled retry",
		"delivery_id", d.ID,
		"attempt", nextAttempt,
		"next_retry_at", nextRetry,
		"error", sendErr,
	)
}

func (p *Processor) markFailed(ctx context.Context, d *dbgen.GetPendingDeliveriesRow, err error) {
	if markErr := p.queries.MarkDeliveryFailed(ctx, dbgen.MarkDeliveryFailedParams{
		ID: d.ID,
		LastError: pgtype.Text{
			String: err.Error(),
			Valid:  true,
		},
	}); markErr != nil {
		p.logger.Error("failed to mark delivery as failed",
			"delivery_id", d.ID,
			"error", markErr,
		)
		return
	}

	p.logger.Error("delivery permanently failed",
		"delivery_id", d.ID,
		"attempts", d.Attempts+1,
		"error", err,
	)
}
