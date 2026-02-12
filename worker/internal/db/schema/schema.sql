-- Schema definitions for sqlc code generation.
-- Must match the Drizzle-managed Postgres schema.

CREATE TABLE blueprints (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    name            text NOT NULL,
    url             text NOT NULL,
    schema_type     text NOT NULL,
    extraction_rules jsonb NOT NULL,
    status          text NOT NULL DEFAULT 'draft',
    version         integer NOT NULL DEFAULT 1,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz
);

CREATE TABLE watches (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                text NOT NULL,
    blueprint_id          uuid NOT NULL REFERENCES blueprints(id),
    name                  text NOT NULL,
    url                   text NOT NULL,
    schedule              text NOT NULL,
    identity_fields       text[] NOT NULL DEFAULT ARRAY['name']::text[],
    status                text NOT NULL DEFAULT 'active',
    next_run_at           timestamptz,
    consecutive_failures  integer NOT NULL DEFAULT 0,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz
);

CREATE TABLE entities (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    watch_id        uuid NOT NULL REFERENCES watches(id),
    schema_type     text NOT NULL,
    external_id     text NOT NULL,
    content         jsonb NOT NULL,
    url             text,
    status          text NOT NULL DEFAULT 'active',
    first_seen_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (org_id, watch_id, schema_type, external_id)
);

CREATE TABLE watch_runs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          text NOT NULL,
    watch_id        uuid NOT NULL REFERENCES watches(id),
    status          text NOT NULL DEFAULT 'running',
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    entities_found  integer,
    entities_new    integer,
    entities_changed integer,
    entities_removed integer,
    error_message   text
);
