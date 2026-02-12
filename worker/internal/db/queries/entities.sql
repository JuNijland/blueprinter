-- name: GetEntitiesByWatch :many
SELECT * FROM entities
WHERE watch_id = $1 AND status = 'active'
ORDER BY external_id;

-- name: UpsertEntity :one
INSERT INTO entities (org_id, watch_id, schema_type, external_id, content, url, status, first_seen_at, last_seen_at)
VALUES ($1, $2, $3, $4, $5, $6, 'active', now(), now())
ON CONFLICT (org_id, watch_id, schema_type, external_id) DO UPDATE
SET content = EXCLUDED.content,
    url = EXCLUDED.url,
    status = 'active',
    last_seen_at = now(),
    updated_at = now()
RETURNING *;

-- name: MarkEntitiesStale :exec
UPDATE entities
SET status = 'stale', updated_at = now()
WHERE watch_id = $1 AND external_id = ANY($2::text[])
  AND status = 'active';
