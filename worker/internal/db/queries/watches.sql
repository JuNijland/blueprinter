-- name: GetDueWatches :many
SELECT w.*, b.extraction_rules, b.schema_type
FROM watches w
JOIN blueprints b ON b.id = w.blueprint_id
WHERE w.status = 'active'
  AND w.deleted_at IS NULL
  AND w.next_run_at <= now()
ORDER BY w.next_run_at ASC
LIMIT 50;

-- name: GetWatchByID :one
SELECT w.*, b.extraction_rules, b.schema_type
FROM watches w
JOIN blueprints b ON b.id = w.blueprint_id
WHERE w.id = $1 AND w.deleted_at IS NULL;

-- name: UpdateWatchAfterRun :exec
UPDATE watches
SET next_run_at = $2,
    consecutive_failures = $3,
    status = $4,
    updated_at = now()
WHERE id = $1;
