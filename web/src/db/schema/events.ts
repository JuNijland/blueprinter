import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { watches } from "./watches";
import { watchRuns } from "./watch-runs";
import { entities } from "./entities";

export const events = pgTable(
  "events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: text("org_id").notNull(),
    eventType: text("event_type").notNull(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id),
    watchRunId: uuid("watch_run_id").references(() => watchRuns.id),
    entityId: uuid("entity_id").references(() => entities.id),
    payload: jsonb("payload").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_events_org_id").on(table.orgId),
    index("idx_events_occurred_at").on(table.orgId, table.occurredAt),
    index("idx_events_watch_id").on(table.watchId),
    index("idx_events_entity_id").on(table.entityId),
    index("idx_events_type").on(table.orgId, table.eventType),
  ],
);
