# Blueprinter — Database Schema

All tables include `org_id` for multitenancy. All primary keys are UUIDv7. All timestamps are `timestamptz` in UTC.

## ER Diagram

```
blueprints ──< watches
watches ──< entities
watches ──< events
entities ──< events
events ──< deliveries
subscriptions ──< deliveries
```

---

## Tables

### blueprints

Extraction rules for pulling structured entities from a page.

```sql
CREATE TABLE blueprints (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    name            text NOT NULL,
    url             text NOT NULL,           -- test URL used to generate/test the blueprint
    schema_type     text NOT NULL,          -- 'ecommerce_product', 'job_vacancy'
    extraction_rules jsonb NOT NULL,        -- XPath mappings
    status          text NOT NULL DEFAULT 'draft',  -- draft, active, failed, archived
    version         integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()

    CONSTRAINT chk_blueprint_status CHECK (status IN ('draft', 'active', 'failed', 'archived')),
);

CREATE INDEX idx_blueprints_org_id ON blueprints (org_id) WHERE deleted_at IS NULL;
```

`extraction_rules` example for an e-commerce product list:
```json
{
  "container": "//div[@class='product-list']/div",
  "fields": {
    "name": ".//h2[@class='title']/text()",
    "price": ".//span[@data-price]/text()",
    "currency": ".//span[@data-currency]/@data-currency",
    "seller": ".//a[@class='seller-name']/text()",
    "image_url": ".//img[@class='product-image']/@src",
    "rating": ".//span[@class='rating']/@data-value",
    "review_count": ".//span[@class='review-count']/text()",
    "availability": ".//span[@class='stock-status']/text()"
  }
}
```

---

### entities

Tracked structured records from sources. Stores current state; history is reconstructed from events.

```sql
CREATE TABLE entities (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    watch_id        uuid NOT NULL REFERENCES watches(id),
    schema_type     text NOT NULL,
    external_id     text NOT NULL,          -- derived from source (SKU, URL slug, etc.)
    content         jsonb NOT NULL,         -- current entity state matching schema
    url             text,                   -- direct URL to this entity if available
    status          text NOT NULL DEFAULT 'active',  -- active, stale, removed
    first_seen_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chk_entity_status CHECK (status IN ('active', 'stale', 'removed')),
    UNIQUE (org_id, watch_id, schema_type, external_id)
);

CREATE INDEX idx_entities_org_id ON entities (org_id);
CREATE INDEX idx_entities_watch_id ON entities (watch_id);
CREATE INDEX idx_entities_status ON entities (org_id, status);
CREATE INDEX idx_entities_external_id ON entities (org_id, watch_id, external_id);
```

`content` example for `ecommerce_product`:
```json
{
  "name": "Sony WH-1000XM5",
  "price": 29999,
  "currency": "EUR",
  "seller": "TechStore NL",
  "image_url": "https://...",
  "rating": 4.7,
  "review_count": 1823,
  "availability": "in_stock"
}
```

Note: prices are stored as **integers in cents** to avoid floating point comparison issues in the diff engine.

---

### watches

Scheduled jobs that periodically extract and diff entities from a URL.

```sql
CREATE TABLE watches (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                text NOT NULL,
    blueprint_id          uuid NOT NULL REFERENCES blueprints(id),
    name                  text NOT NULL,
    url                   text NOT NULL,           -- specific URL to monitor
    schedule              text NOT NULL,            -- cron expression
    status                text NOT NULL DEFAULT 'active',  -- active, paused, error
    last_run_at           timestamptz,
    next_run_at           timestamptz,
    last_error            text,
    consecutive_failures  integer NOT NULL DEFAULT 0,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz,

    CONSTRAINT chk_watch_status CHECK (status IN ('active', 'paused', 'error'))
);

CREATE INDEX idx_watches_org_id ON watches (org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_watches_next_run ON watches (next_run_at)
    WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_watches_blueprint_id ON watches (blueprint_id) WHERE deleted_at IS NULL;
```

---

### watch_runs

Individual execution records for watch runs. Useful for debugging and observability.

```sql
CREATE TABLE watch_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    watch_id        uuid NOT NULL REFERENCES watches(id),
    status          text NOT NULL DEFAULT 'running',  -- running, completed, failed
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    entities_found  integer,
    entities_new    integer,
    entities_changed integer,
    entities_removed integer,
    events_emitted  integer,
    error_message   text,

    CONSTRAINT chk_run_status CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_watch_runs_watch_id ON watch_runs (watch_id);
CREATE INDEX idx_watch_runs_org_id ON watch_runs (org_id);
```

---

### events

Change events detected by watch runs.

```sql
CREATE TABLE events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    event_type      text NOT NULL,          -- entity_appeared, entity_disappeared, entity_changed, watch_error
    watch_id        uuid NOT NULL REFERENCES watches(id),
    watch_run_id    uuid REFERENCES watch_runs(id),
    entity_id       uuid REFERENCES entities(id),  -- nullable for watch_error events
    payload         jsonb NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chk_event_type CHECK (event_type IN (
        'entity_appeared', 'entity_disappeared', 'entity_changed', 'watch_error'
    ))
);

CREATE INDEX idx_events_org_id ON events (org_id);
CREATE INDEX idx_events_occurred_at ON events (org_id, occurred_at DESC);
CREATE INDEX idx_events_watch_id ON events (watch_id);
CREATE INDEX idx_events_entity_id ON events (entity_id);
CREATE INDEX idx_events_type ON events (org_id, event_type);
```

---

### subscriptions

Rules for routing events to channels.

```sql
CREATE TABLE subscriptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    name            text NOT NULL,
    event_types     text[] NOT NULL,        -- array of event types to subscribe to
    watch_id        uuid REFERENCES watches(id),    -- optional: scope to watch
    filters         jsonb NOT NULL DEFAULT '{}',    -- optional field-level filters
    channel_type    text NOT NULL,          -- webhook, email, slack
    channel_config  jsonb NOT NULL,         -- channel-specific settings
    status          text NOT NULL DEFAULT 'active',  -- active, paused
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,

    CONSTRAINT chk_subscription_status CHECK (status IN ('active', 'paused')),
    CONSTRAINT chk_channel_type CHECK (channel_type IN ('webhook', 'email', 'slack'))
);

CREATE INDEX idx_subscriptions_org_id ON subscriptions (org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subscriptions_matching ON subscriptions (org_id, status)
    WHERE status = 'active' AND deleted_at IS NULL;
```

`channel_config` examples:
```json
// webhook
{
  "url": "https://hooks.example.com/blueprinter",
  "secret": "whsec_...",
  "headers": { "X-Custom": "value" }
}

// email
{
  "to": ["alerts@example.com"],
  "subject_template": "Price change: {{entity.name}}"
}

// slack
{
  "webhook_url": "https://hooks.slack.com/services/T.../B.../..."
}
```

`filters` example:
```json
{
  "conditions": [
    { "field": "price", "operator": "decreased" },
    { "field": "price", "change_pct_gte": 10 }
  ]
}
```

---

### deliveries

Outbox pattern for reliable event delivery to subscriptions.

```sql
CREATE TABLE deliveries (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    event_id        uuid NOT NULL REFERENCES events(id),
    subscription_id uuid NOT NULL REFERENCES subscriptions(id),
    status          text NOT NULL DEFAULT 'pending',  -- pending, delivered, failed
    attempts        integer NOT NULL DEFAULT 0,
    max_attempts    integer NOT NULL DEFAULT 5,
    next_retry_at   timestamptz NOT NULL DEFAULT now(),
    last_error      text,
    delivered_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT chk_delivery_status CHECK (status IN ('pending', 'delivered', 'failed'))
);

CREATE INDEX idx_deliveries_pending ON deliveries (next_retry_at)
    WHERE status = 'pending';
CREATE INDEX idx_deliveries_org_id ON deliveries (org_id);
CREATE INDEX idx_deliveries_event_id ON deliveries (event_id);
CREATE INDEX idx_deliveries_subscription_id ON deliveries (subscription_id);
```

---

## Subscription Matching Logic

When an event is created, matching subscriptions are found with:

```sql
SELECT id FROM subscriptions
WHERE org_id = $1
  AND status = 'active'
  AND deleted_at IS NULL
  AND $2 = ANY(event_types)                          -- event type matches
  AND (watch_id IS NULL OR watch_id = $3);           -- watch scope matches
```

Filter evaluation (the `filters` JSONB) happens in application code after the SQL query, since filter logic is more complex (field-level change direction, percentage thresholds, etc.).

---

## Migration Order

```
001_create_blueprints.sql
002_create_watches.sql
003_create_entities.sql
004_create_watch_runs.sql
005_create_events.sql
006_create_subscriptions.sql
007_create_deliveries.sql
```

---

## Notes

- **No users table**: We rely on WorkOS for all user/org data. `org_id` is a text field containing the WorkOS organization ID.
- **No entity history table**: Entity history is reconstructed by replaying events. If this becomes a performance problem, we can add a materialized history table later.
- **Prices as integers**: All monetary values stored in smallest currency unit (cents) to avoid floating point issues.
- **UUIDv7**: Time-sortable UUIDs give us natural ordering without needing a separate `created_at` index for most queries. Use `uuid_generate_v7()` or generate in application code.
- **Soft deletes**: Blueprints, watches, and subscriptions use `deleted_at`. Events, deliveries, entities, and watch_runs are never soft-deleted (they're append-only / immutable).
