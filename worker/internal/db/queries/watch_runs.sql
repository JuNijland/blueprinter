-- name: CreateWatchRun :one
INSERT INTO watch_runs (org_id, watch_id, status, started_at)
VALUES ($1, $2, 'running', now())
RETURNING *;

-- name: CompleteWatchRun :exec
UPDATE watch_runs
SET status = $2,
    completed_at = now(),
    entities_found = $3,
    entities_new = $4,
    entities_changed = $5,
    entities_removed = $6,
    events_emitted = $7,
    error_message = $8
WHERE id = $1;
