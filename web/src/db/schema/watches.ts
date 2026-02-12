import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { blueprints } from "./blueprints";

export const watches = pgTable(
  "watches",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: text("org_id").notNull(),
    blueprintId: uuid("blueprint_id")
      .notNull()
      .references(() => blueprints.id),
    name: text("name").notNull(),
    url: text("url").notNull(),
    schedule: text("schedule").notNull(),
    identityFields: text("identity_fields")
      .array()
      .notNull()
      .default(sql`ARRAY['name']::text[]`),
    status: text("status").notNull().default("active"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_watches_org_id")
      .on(table.orgId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("idx_watches_next_run")
      .on(table.nextRunAt)
      .where(
        sql`${table.status} = 'active' AND ${table.deletedAt} IS NULL`
      ),
    index("idx_watches_blueprint_id")
      .on(table.blueprintId)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);
