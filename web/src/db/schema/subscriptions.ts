import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { watches } from "./watches";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    eventTypes: text("event_types").array().notNull(),
    watchId: uuid("watch_id").references(() => watches.id),
    filters: jsonb("filters").notNull().default({}),
    channelType: text("channel_type").notNull().default("email"),
    channelConfig: jsonb("channel_config").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_subscriptions_org_id")
      .on(table.orgId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_subscriptions_watch_id")
      .on(table.watchId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_subscriptions_status")
      .on(table.orgId, table.status)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);
