-- name: InsertDelivery :one
INSERT INTO deliveries (org_id, event_id, subscription_id, status, attempts, max_attempts, next_retry_at)
VALUES ($1, $2, $3, 'pending', 0, 5, now())
RETURNING *;

-- name: GetPendingDeliveries :many
SELECT
  d.id, d.org_id, d.event_id, d.subscription_id, d.status,
  d.attempts, d.max_attempts, d.next_retry_at, d.last_error,
  d.delivered_at, d.created_at,
  s.name AS subscription_name, s.channel_type, s.channel_config,
  e.event_type, e.payload AS event_payload
FROM deliveries d
JOIN subscriptions s ON s.id = d.subscription_id
JOIN events e ON e.id = d.event_id
WHERE d.status = 'pending'
  AND d.next_retry_at <= now()
ORDER BY d.next_retry_at ASC
LIMIT 50;

-- name: MarkDeliveryDelivered :exec
UPDATE deliveries
SET status = 'delivered',
    delivered_at = now(),
    attempts = attempts + 1
WHERE id = $1;

-- name: MarkDeliveryRetry :exec
UPDATE deliveries
SET attempts = attempts + 1,
    next_retry_at = $2,
    last_error = $3
WHERE id = $1;

-- name: MarkDeliveryFailed :exec
UPDATE deliveries
SET status = 'failed',
    attempts = attempts + 1,
    last_error = $2
WHERE id = $1;
