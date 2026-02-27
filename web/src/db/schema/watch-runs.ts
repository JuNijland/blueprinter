import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { watches } from "./watches";

export const watchRuns = pgTable(
  "watch_runs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: text("org_id").notNull(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    entitiesFound: integer("entities_found"),
    entitiesNew: integer("entities_new"),
    entitiesChanged: integer("entities_changed"),
    entitiesRemoved: integer("entities_removed"),
    eventsEmitted: integer("events_emitted"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_watch_runs_watch_id").on(table.watchId),
    index("idx_watch_runs_org_id").on(table.orgId),
  ],
);
