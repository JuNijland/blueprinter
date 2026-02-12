import { pgTable, text, uuid, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const blueprints = pgTable(
  "blueprints",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    schemaType: text("schema_type").notNull(),
    extractionRules: jsonb("extraction_rules").notNull(),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_blueprints_org_id")
      .on(table.orgId)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);
