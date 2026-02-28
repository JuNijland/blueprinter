package matcher

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/blueprinter/worker/internal/db/dbgen"
	"github.com/blueprinter/worker/internal/filter"
)

// Matcher matches events to subscriptions and creates delivery rows.
type Matcher struct {
	queries *dbgen.Queries
	logger  *slog.Logger
}

// New creates a new Matcher.
func New(queries *dbgen.Queries, logger *slog.Logger) *Matcher {
	return &Matcher{
		queries: queries,
		logger:  logger,
	}
}

// CreateDeliveries finds subscriptions that match the given event and creates delivery rows.
func (m *Matcher) CreateDeliveries(ctx context.Context, event dbgen.Event) error {
	subs, err := m.queries.MatchSubscriptions(ctx, dbgen.MatchSubscriptionsParams{
		OrgID:   event.OrgID,
		Column2: event.EventType,
		WatchID: event.WatchID,
	})
	if err != nil {
		return fmt.Errorf("matching subscriptions: %w", err)
	}

	if len(subs) == 0 {
		return nil
	}

	matched := 0
	for _, sub := range subs {
		filters, err := filter.ParseFilters(sub.Filters)
		if err != nil {
			m.logger.Warn("failed to parse subscription filters",
				"subscription_id", sub.ID,
				"error", err,
			)
			continue
		}

		ok, err := filter.Match(event.EventType, event.Payload, filters)
		if err != nil {
			m.logger.Warn("failed to evaluate filters",
				"subscription_id", sub.ID,
				"error", err,
			)
			continue
		}

		if !ok {
			continue
		}

		if _, err := m.queries.InsertDelivery(ctx, dbgen.InsertDeliveryParams{
			OrgID:          event.OrgID,
			EventID:        event.ID,
			SubscriptionID: sub.ID,
		}); err != nil {
			return fmt.Errorf("inserting delivery for subscription %v: %w", sub.ID, err)
		}
		matched++
	}

	if matched > 0 {
		m.logger.Info("created deliveries",
			"event_id", event.ID,
			"event_type", event.EventType,
			"subscriptions_matched", matched,
		)
	}

	return nil
}
