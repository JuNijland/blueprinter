"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { db } from "@/db";
import { watches, watchRuns, entities, blueprints } from "@/db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { workerTriggerRun } from "@/lib/worker-client";

async function getOrgId(): Promise<string> {
  const { organizationId } = await withAuth({ ensureSignedIn: true });
  if (!organizationId) {
    throw new Error("No organization selected");
  }
  return organizationId;
}

export async function listWatches() {
  const orgId = await getOrgId();
  const rows = await db
    .select({
      id: watches.id,
      name: watches.name,
      url: watches.url,
      schedule: watches.schedule,
      status: watches.status,
      nextRunAt: watches.nextRunAt,
      consecutiveFailures: watches.consecutiveFailures,
      createdAt: watches.createdAt,
      blueprintName: blueprints.name,
      blueprintId: watches.blueprintId,
      lastRunAt: sql<
        string | null
      >`(SELECT started_at FROM watch_runs WHERE watch_id = ${watches.id} ORDER BY started_at DESC LIMIT 1)`.as(
        "last_run_at",
      ),
    })
    .from(watches)
    .leftJoin(blueprints, eq(watches.blueprintId, blueprints.id))
    .where(and(eq(watches.orgId, orgId), isNull(watches.deletedAt)))
    .orderBy(desc(watches.createdAt));
  return rows.map((r) => ({
    ...r,
    lastRunAt: r.lastRunAt ? new Date(r.lastRunAt) : null,
  }));
}

export async function getWatch(id: string) {
  const orgId = await getOrgId();
  const rows = await db
    .select({
      id: watches.id,
      orgId: watches.orgId,
      blueprintId: watches.blueprintId,
      name: watches.name,
      url: watches.url,
      schedule: watches.schedule,
      identityFields: watches.identityFields,
      status: watches.status,
      nextRunAt: watches.nextRunAt,
      consecutiveFailures: watches.consecutiveFailures,
      createdAt: watches.createdAt,
      updatedAt: watches.updatedAt,
      blueprintName: blueprints.name,
      blueprintSchemaType: blueprints.schemaType,
      lastRunAt: sql<
        string | null
      >`(SELECT started_at FROM watch_runs WHERE watch_id = ${watches.id} ORDER BY started_at DESC LIMIT 1)`.as(
        "last_run_at",
      ),
      lastError: sql<
        string | null
      >`(SELECT error_message FROM watch_runs WHERE watch_id = ${watches.id} ORDER BY started_at DESC LIMIT 1)`.as(
        "last_error",
      ),
    })
    .from(watches)
    .leftJoin(blueprints, eq(watches.blueprintId, blueprints.id))
    .where(and(eq(watches.id, id), eq(watches.orgId, orgId), isNull(watches.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    lastRunAt: row.lastRunAt ? new Date(row.lastRunAt) : null,
  };
}

export async function createWatch(data: {
  blueprintId: string;
  name: string;
  url: string;
  schedule: string;
  identityFields?: string[];
}) {
  const orgId = await getOrgId();
  const rows = await db
    .insert(watches)
    .values({
      orgId,
      blueprintId: data.blueprintId,
      name: data.name,
      url: data.url,
      schedule: data.schedule,
      identityFields: data.identityFields ?? ["name"],
      nextRunAt: new Date(),
    })
    .returning();
  return rows[0];
}

export async function updateWatch(
  id: string,
  data: Partial<{
    name: string;
    url: string;
    schedule: string;
    identityFields: string[];
    blueprintId: string;
  }>,
) {
  const orgId = await getOrgId();
  await db
    .update(watches)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(watches.id, id), eq(watches.orgId, orgId)));
}

export async function deleteWatch(id: string) {
  const orgId = await getOrgId();
  await db
    .update(watches)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(watches.id, id), eq(watches.orgId, orgId)));
}

export async function pauseWatch(id: string) {
  const orgId = await getOrgId();
  await db
    .update(watches)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(watches.id, id), eq(watches.orgId, orgId)));
}

export async function resumeWatch(id: string) {
  const orgId = await getOrgId();
  await db
    .update(watches)
    .set({
      status: "active",
      consecutiveFailures: 0,
      nextRunAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(watches.id, id), eq(watches.orgId, orgId)));
}

export async function listWatchRuns(watchId: string) {
  const orgId = await getOrgId();
  return db
    .select()
    .from(watchRuns)
    .where(and(eq(watchRuns.watchId, watchId), eq(watchRuns.orgId, orgId)))
    .orderBy(desc(watchRuns.startedAt))
    .limit(20);
}

export async function listWatchEntities(watchId: string) {
  const orgId = await getOrgId();
  return db
    .select()
    .from(entities)
    .where(
      and(eq(entities.watchId, watchId), eq(entities.orgId, orgId), eq(entities.status, "active")),
    )
    .orderBy(desc(entities.lastSeenAt));
}

export async function triggerWatchRun(watchId: string) {
  const orgId = await getOrgId();

  // Verify the watch exists and belongs to org
  const watch = await db
    .select({ id: watches.id })
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.orgId, orgId), isNull(watches.deletedAt)))
    .limit(1);

  if (!watch[0]) {
    throw new Error("Watch not found");
  }

  return workerTriggerRun(orgId, watchId);
}
