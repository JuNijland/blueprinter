import { pgTable, text, uuid, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { watches } from "./watches";

export const entities = pgTable(
  "entities",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: text("org_id").notNull(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id),
    schemaType: text("schema_type").notNull(),
    externalId: text("external_id").notNull(),
    content: jsonb("content").notNull(),
    url: text("url"),
    status: text("status").notNull().default("active"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_entities_identity").on(
      table.orgId,
      table.watchId,
      table.schemaType,
      table.externalId,
    ),
    index("idx_entities_org_id").on(table.orgId),
    index("idx_entities_watch_id").on(table.watchId),
    index("idx_entities_status").on(table.orgId, table.status),
  ],
);
