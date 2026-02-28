-- name: MatchSubscriptions :many
SELECT * FROM subscriptions
WHERE org_id = $1
  AND status = 'active'
  AND deleted_at IS NULL
  AND $2::text = ANY(event_types)
  AND (watch_id IS NULL OR watch_id = $3)
ORDER BY created_at ASC;
