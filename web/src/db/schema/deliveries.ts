import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { events } from "./events";
import { subscriptions } from "./subscriptions";

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: text("org_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_deliveries_pending").on(table.nextRetryAt).where(
      sql`${table.status} = 'pending'`,
    ),
    index("idx_deliveries_org_id").on(table.orgId),
    index("idx_deliveries_event_id").on(table.eventId),
    index("idx_deliveries_subscription_id").on(table.subscriptionId),
  ],
);
