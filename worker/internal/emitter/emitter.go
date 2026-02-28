package emitter

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/blueprinter/worker/internal/db/dbgen"
	"github.com/blueprinter/worker/internal/differ"
)

// Matcher creates delivery rows for matching subscriptions.
type Matcher interface {
	CreateDeliveries(ctx context.Context, event dbgen.Event) error
}

// Emitter persists change events detected by the differ.
type Emitter struct {
	queries *dbgen.Queries
	matcher Matcher
	logger  *slog.Logger
}

// New creates a new Emitter.
func New(queries *dbgen.Queries, logger *slog.Logger) *Emitter {
	return &Emitter{
		queries: queries,
		logger:  logger,
	}
}

// SetMatcher sets the matcher for subscription matching after event emission.
func (e *Emitter) SetMatcher(m Matcher) {
	e.matcher = m
}

// EmitContext provides the context for emitting events.
type EmitContext struct {
	OrgID      string
	WatchID    pgtype.UUID
	WatchRunID pgtype.UUID
}

// EmitDiffEvents converts a DiffResult into event rows and persists them.
// entityIDs maps external_id -> entity UUID (from upsert results and stored entities).
// Returns the count of events emitted.
func (e *Emitter) EmitDiffEvents(ctx context.Context, ec EmitContext, diff *differ.DiffResult, entityIDs map[string]pgtype.UUID) (int, error) {
	count := 0

	for _, d := range diff.Appeared {
		payload, err := buildAppearedPayload(d)
		if err != nil {
			e.logger.Warn("failed to build appeared payload", "external_id", d.ExternalID, "error", err)
			continue
		}

		entityID := entityIDs[d.ExternalID]
		event, err := e.queries.InsertEvent(ctx, dbgen.InsertEventParams{
			OrgID:      ec.OrgID,
			EventType:  "entity_appeared",
			WatchID:    ec.WatchID,
			WatchRunID: ec.WatchRunID,
			EntityID:   entityID,
			Payload:    payload,
		})
		if err != nil {
			return count, fmt.Errorf("inserting entity_appeared event: %w", err)
		}
		e.matchEvent(ctx, event)
		count++
	}

	for _, d := range diff.Changed {
		payload, err := buildChangedPayload(d)
		if err != nil {
			e.logger.Warn("failed to build changed payload", "external_id", d.ExternalID, "error", err)
			continue
		}

		entityID := entityIDs[d.ExternalID]
		event, err := e.queries.InsertEvent(ctx, dbgen.InsertEventParams{
			OrgID:      ec.OrgID,
			EventType:  "entity_changed",
			WatchID:    ec.WatchID,
			WatchRunID: ec.WatchRunID,
			EntityID:   entityID,
			Payload:    payload,
		})
		if err != nil {
			return count, fmt.Errorf("inserting entity_changed event: %w", err)
		}
		e.matchEvent(ctx, event)
		count++
	}

	for _, d := range diff.Disappeared {
		payload, err := buildDisappearedPayload(d)
		if err != nil {
			e.logger.Warn("failed to build disappeared payload", "external_id", d.ExternalID, "error", err)
			continue
		}

		entityID := entityIDs[d.ExternalID]
		event, err := e.queries.InsertEvent(ctx, dbgen.InsertEventParams{
			OrgID:      ec.OrgID,
			EventType:  "entity_disappeared",
			WatchID:    ec.WatchID,
			WatchRunID: ec.WatchRunID,
			EntityID:   entityID,
			Payload:    payload,
		})
		if err != nil {
			return count, fmt.Errorf("inserting entity_disappeared event: %w", err)
		}
		e.matchEvent(ctx, event)
		count++
	}

	return count, nil
}

// matchEvent calls the matcher to create deliveries for the given event.
// Errors are logged but do not fail event emission.
func (e *Emitter) matchEvent(ctx context.Context, event dbgen.Event) {
	if e.matcher == nil {
		return
	}
	if err := e.matcher.CreateDeliveries(ctx, event); err != nil {
		e.logger.Warn("failed to create deliveries for event",
			"event_id", event.ID,
			"event_type", event.EventType,
			"error", err,
		)
	}
}

// appearedPayload is the JSON structure for entity_appeared events.
type appearedPayload struct {
	Entity map[string]any `json:"entity"`
}

// changedPayload is the JSON structure for entity_changed events.
type changedPayload struct {
	Changes []differ.FieldChange `json:"changes"`
	Entity  map[string]any       `json:"entity"`
}

// disappearedPayload is the JSON structure for entity_disappeared events.
type disappearedPayload struct {
	Entity map[string]any `json:"entity"`
}

func buildAppearedPayload(d differ.EntityDiff) ([]byte, error) {
	p := appearedPayload{
		Entity: d.Content,
	}
	return json.Marshal(p)
}

func buildChangedPayload(d differ.EntityDiff) ([]byte, error) {
	p := changedPayload{
		Changes: d.Changes,
		Entity:  d.Content,
	}
	return json.Marshal(p)
}

func buildDisappearedPayload(d differ.EntityDiff) ([]byte, error) {
	p := disappearedPayload{
		Entity: map[string]any{
			"external_id": d.ExternalID,
		},
	}
	return json.Marshal(p)
}
