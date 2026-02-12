package scheduler

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/robfig/cron/v3"

	"github.com/blueprinter/worker/internal/blueprint"
	"github.com/blueprinter/worker/internal/db/dbgen"
	"github.com/blueprinter/worker/internal/differ"
	"github.com/blueprinter/worker/internal/fetcher"
)

const maxConsecutiveFailures = 3

// Executor handles single watch run execution.
type Executor struct {
	queries *dbgen.Queries
	fetcher *fetcher.Client
	logger  *slog.Logger
}

// NewExecutor creates a new Executor.
func NewExecutor(queries *dbgen.Queries, fetcher *fetcher.Client, logger *slog.Logger) *Executor {
	return &Executor{
		queries: queries,
		fetcher: fetcher,
		logger:  logger,
	}
}

// Execute runs a single watch from a GetDueWatchesRow.
func (e *Executor) Execute(ctx context.Context, watch dbgen.GetDueWatchesRow) {
	logger := e.logger.With("watch_id", uuidToString(watch.ID), "watch_name", watch.Name)
	logger.Info("executing watch run")

	// 1. Create watch_run record
	run, err := e.queries.CreateWatchRun(ctx, dbgen.CreateWatchRunParams{
		OrgID:   watch.OrgID,
		WatchID: watch.ID,
	})
	if err != nil {
		logger.Error("failed to create watch run", "error", err)
		return
	}

	// Execute and handle result
	stats, execErr := e.executeRun(ctx, watch, logger)

	// 2. Complete the watch run
	completeStatus := "completed"
	var errorMsg pgtype.Text
	if execErr != nil {
		completeStatus = "failed"
		errorMsg = pgtype.Text{String: execErr.Error(), Valid: true}
	}

	if err := e.queries.CompleteWatchRun(ctx, dbgen.CompleteWatchRunParams{
		ID:              run.ID,
		Status:          completeStatus,
		EntitiesFound:   pgInt4(stats.found),
		EntitiesNew:     pgInt4(stats.newCount),
		EntitiesChanged: pgInt4(stats.changed),
		EntitiesRemoved: pgInt4(stats.removed),
		ErrorMessage:    errorMsg,
	}); err != nil {
		logger.Error("failed to complete watch run", "error", err)
	}

	// 3. Update watch metadata
	e.updateWatchAfterRun(ctx, watch, execErr, logger)
}

// ExecuteByID runs a watch by its UUID string (for manual trigger).
func (e *Executor) ExecuteByID(ctx context.Context, watchID string) (string, error) {
	var id pgtype.UUID
	if err := id.Scan(watchID); err != nil {
		return "", fmt.Errorf("invalid watch ID: %w", err)
	}

	watch, err := e.queries.GetWatchByID(ctx, id)
	if err != nil {
		return "", fmt.Errorf("getting watch: %w", err)
	}

	// Create watch_run
	run, err := e.queries.CreateWatchRun(ctx, dbgen.CreateWatchRunParams{
		OrgID:   watch.OrgID,
		WatchID: watch.ID,
	})
	if err != nil {
		return "", fmt.Errorf("creating watch run: %w", err)
	}

	// Convert to DueWatchesRow for shared execution logic
	dueRow := dbgen.GetDueWatchesRow{
		ID:                  watch.ID,
		OrgID:               watch.OrgID,
		BlueprintID:         watch.BlueprintID,
		Name:                watch.Name,
		Url:                 watch.Url,
		Schedule:            watch.Schedule,
		IdentityFields:      watch.IdentityFields,
		Status:              watch.Status,
		NextRunAt:           watch.NextRunAt,
		ConsecutiveFailures: watch.ConsecutiveFailures,
		CreatedAt:           watch.CreatedAt,
		UpdatedAt:           watch.UpdatedAt,
		DeletedAt:           watch.DeletedAt,
		ExtractionRules:     watch.ExtractionRules,
		SchemaType:          watch.SchemaType,
	}

	logger := e.logger.With("watch_id", watchID, "watch_name", watch.Name)

	stats, execErr := e.executeRun(ctx, dueRow, logger)

	completeStatus := "completed"
	var errorMsg pgtype.Text
	if execErr != nil {
		completeStatus = "failed"
		errorMsg = pgtype.Text{String: execErr.Error(), Valid: true}
	}

	if err := e.queries.CompleteWatchRun(ctx, dbgen.CompleteWatchRunParams{
		ID:              run.ID,
		Status:          completeStatus,
		EntitiesFound:   pgInt4(stats.found),
		EntitiesNew:     pgInt4(stats.newCount),
		EntitiesChanged: pgInt4(stats.changed),
		EntitiesRemoved: pgInt4(stats.removed),
		ErrorMessage:    errorMsg,
	}); err != nil {
		logger.Error("failed to complete watch run", "error", err)
	}

	e.updateWatchAfterRun(ctx, dueRow, execErr, logger)

	runID := uuidToString(run.ID)
	if execErr != nil {
		return runID, execErr
	}
	return runID, nil
}

type runStats struct {
	found    int
	newCount int
	changed  int
	removed  int
}

func (e *Executor) executeRun(ctx context.Context, watch dbgen.GetDueWatchesRow, logger *slog.Logger) (runStats, error) {
	var stats runStats

	// 1. Parse extraction rules from JSON
	var rules blueprint.ExtractionRules
	if err := json.Unmarshal(watch.ExtractionRules, &rules); err != nil {
		return stats, fmt.Errorf("parsing extraction rules: %w", err)
	}

	// 2. Fetch HTML
	rawHTML, err := e.fetcher.FetchHTML(ctx, watch.Url)
	if err != nil {
		return stats, fmt.Errorf("fetching HTML: %w", err)
	}

	// 3. Clean HTML
	cleanedHTML, err := blueprint.Clean(rawHTML)
	if err != nil {
		return stats, fmt.Errorf("cleaning HTML: %w", err)
	}

	// 4. Extract entities
	extractedRaw, err := blueprint.Extract(cleanedHTML, &rules)
	if err != nil {
		return stats, fmt.Errorf("extracting entities: %w", err)
	}

	stats.found = len(extractedRaw)
	logger.Info("entities extracted", "count", stats.found)

	// 5. Compute external IDs and build extracted map
	extracted := make(map[string]map[string]any, len(extractedRaw))
	for _, entity := range extractedRaw {
		eid := computeExternalID(entity, watch.IdentityFields)
		extracted[eid] = entity
	}

	// 6. Load stored entities
	storedEntities, err := e.queries.GetEntitiesByWatch(ctx, watch.ID)
	if err != nil {
		return stats, fmt.Errorf("loading stored entities: %w", err)
	}

	stored := make(map[string]map[string]any, len(storedEntities))
	for _, se := range storedEntities {
		var content map[string]any
		if err := json.Unmarshal(se.Content, &content); err != nil {
			logger.Warn("failed to unmarshal stored entity", "entity_id", uuidToString(se.ID), "error", err)
			continue
		}
		stored[se.ExternalID] = content
	}

	// 7. Run differ
	diffResult := differ.Diff(extracted, stored)
	stats.newCount = len(diffResult.Appeared)
	stats.changed = len(diffResult.Changed)
	stats.removed = len(diffResult.Disappeared)

	logger.Info("diff complete",
		"appeared", stats.newCount,
		"changed", stats.changed,
		"disappeared", stats.removed,
		"unchanged", diffResult.Unchanged,
	)

	// 8. Upsert appeared + changed entities
	for _, d := range diffResult.Appeared {
		contentBytes, err := json.Marshal(d.Content)
		if err != nil {
			logger.Warn("failed to marshal entity content", "external_id", d.ExternalID, "error", err)
			continue
		}
		if _, err := e.queries.UpsertEntity(ctx, dbgen.UpsertEntityParams{
			OrgID:      watch.OrgID,
			WatchID:    watch.ID,
			SchemaType: watch.SchemaType,
			ExternalID: d.ExternalID,
			Content:    contentBytes,
		}); err != nil {
			logger.Warn("failed to upsert appeared entity", "external_id", d.ExternalID, "error", err)
		}
	}

	for _, d := range diffResult.Changed {
		contentBytes, err := json.Marshal(d.Content)
		if err != nil {
			logger.Warn("failed to marshal entity content", "external_id", d.ExternalID, "error", err)
			continue
		}
		if _, err := e.queries.UpsertEntity(ctx, dbgen.UpsertEntityParams{
			OrgID:      watch.OrgID,
			WatchID:    watch.ID,
			SchemaType: watch.SchemaType,
			ExternalID: d.ExternalID,
			Content:    contentBytes,
		}); err != nil {
			logger.Warn("failed to upsert changed entity", "external_id", d.ExternalID, "error", err)
		}
	}

	// 9. Mark disappeared entities as stale
	if len(diffResult.Disappeared) > 0 {
		staleIDs := make([]string, len(diffResult.Disappeared))
		for i, d := range diffResult.Disappeared {
			staleIDs[i] = d.ExternalID
		}
		if err := e.queries.MarkEntitiesStale(ctx, dbgen.MarkEntitiesStaleParams{
			WatchID: watch.ID,
			Column2: staleIDs,
		}); err != nil {
			logger.Warn("failed to mark entities stale", "error", err)
		}
	}

	return stats, nil
}

func (e *Executor) updateWatchAfterRun(ctx context.Context, watch dbgen.GetDueWatchesRow, execErr error, logger *slog.Logger) {
	now := time.Now()
	failures := watch.ConsecutiveFailures
	status := watch.Status

	if execErr != nil {
		failures++
		if failures >= maxConsecutiveFailures {
			status = "error"
			logger.Warn("watch circuit breaker tripped", "failures", failures)
		}
	} else {
		failures = 0
	}

	nextRun := computeNextRun(watch.Schedule, now)

	if err := e.queries.UpdateWatchAfterRun(ctx, dbgen.UpdateWatchAfterRunParams{
		ID:                  watch.ID,
		NextRunAt:           pgtype.Timestamptz{Time: nextRun, Valid: true},
		ConsecutiveFailures: failures,
		Status:              status,
	}); err != nil {
		logger.Error("failed to update watch after run", "error", err)
	}
}

// computeExternalID creates a SHA-256 hash from the identity field values.
func computeExternalID(entity map[string]any, identityFields []string) string {
	var parts []string
	// Sort identity fields for deterministic hashing
	fields := make([]string, len(identityFields))
	copy(fields, identityFields)
	sort.Strings(fields)

	for _, field := range fields {
		val, ok := entity[field]
		if !ok || val == nil {
			parts = append(parts, "")
			continue
		}
		parts = append(parts, strings.TrimSpace(fmt.Sprintf("%v", val)))
	}

	hash := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return fmt.Sprintf("%x", hash[:16]) // 32 hex chars
}

// computeNextRun calculates the next run time from a cron expression.
func computeNextRun(schedule string, from time.Time) time.Time {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	sched, err := parser.Parse(schedule)
	if err != nil {
		// Fall back to 1 hour if cron parse fails
		return from.Add(time.Hour)
	}
	return sched.Next(from)
}

func uuidToString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func pgInt4(v int) pgtype.Int4 {
	return pgtype.Int4{Int32: int32(v), Valid: true}
}
