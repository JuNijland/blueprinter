-- name: InsertEvent :one
INSERT INTO events (org_id, event_type, watch_id, watch_run_id, entity_id, payload, occurred_at)
VALUES ($1, $2, $3, $4, $5, $6, now())
RETURNING *;

-- name: GetEventsByWatch :many
SELECT * FROM events
WHERE org_id = $1 AND watch_id = $2
ORDER BY occurred_at DESC
LIMIT $3 OFFSET $4;

-- name: GetEventsByOrg :many
SELECT * FROM events
WHERE org_id = $1
ORDER BY occurred_at DESC
LIMIT $2 OFFSET $3;
