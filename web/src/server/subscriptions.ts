"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { db } from "@/db";
import { subscriptions, deliveries, watches, events } from "@/db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

async function getOrgId(): Promise<string> {
  const { organizationId } = await withAuth({ ensureSignedIn: true });
  if (!organizationId) {
    throw new Error("No organization selected");
  }
  return organizationId;
}

export async function listSubscriptions() {
  const orgId = await getOrgId();
  return db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      eventTypes: subscriptions.eventTypes,
      watchId: subscriptions.watchId,
      channelType: subscriptions.channelType,
      channelConfig: subscriptions.channelConfig,
      status: subscriptions.status,
      createdAt: subscriptions.createdAt,
      watchName: watches.name,
    })
    .from(subscriptions)
    .leftJoin(watches, eq(subscriptions.watchId, watches.id))
    .where(and(eq(subscriptions.orgId, orgId), isNull(subscriptions.deletedAt)))
    .orderBy(desc(subscriptions.createdAt));
}

export async function getSubscription(id: string) {
  const orgId = await getOrgId();
  const rows = await db
    .select({
      id: subscriptions.id,
      orgId: subscriptions.orgId,
      name: subscriptions.name,
      eventTypes: subscriptions.eventTypes,
      watchId: subscriptions.watchId,
      filters: subscriptions.filters,
      channelType: subscriptions.channelType,
      channelConfig: subscriptions.channelConfig,
      status: subscriptions.status,
      createdAt: subscriptions.createdAt,
      updatedAt: subscriptions.updatedAt,
      watchName: watches.name,
    })
    .from(subscriptions)
    .leftJoin(watches, eq(subscriptions.watchId, watches.id))
    .where(and(eq(subscriptions.id, id), eq(subscriptions.orgId, orgId), isNull(subscriptions.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSubscription(data: {
  name: string;
  eventTypes: string[];
  watchId?: string | null;
  filters: Record<string, unknown>;
  channelConfig: { to: string[] };
}) {
  const orgId = await getOrgId();
  const rows = await db
    .insert(subscriptions)
    .values({
      orgId,
      name: data.name,
      eventTypes: data.eventTypes,
      watchId: data.watchId || null,
      filters: data.filters,
      channelType: "email",
      channelConfig: data.channelConfig,
    })
    .returning();
  return rows[0];
}

export async function updateSubscription(
  id: string,
  data: Partial<{
    name: string;
    eventTypes: string[];
    watchId: string | null;
    filters: Record<string, unknown>;
    channelConfig: { to: string[] };
  }>,
) {
  const orgId = await getOrgId();
  await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.orgId, orgId)));
}

export async function deleteSubscription(id: string) {
  const orgId = await getOrgId();
  await db
    .update(subscriptions)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.orgId, orgId)));
}

export async function pauseSubscription(id: string) {
  const orgId = await getOrgId();
  await db
    .update(subscriptions)
    .set({ status: "paused", updatedAt: new Date() })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.orgId, orgId)));
}

export async function resumeSubscription(id: string) {
  const orgId = await getOrgId();
  await db
    .update(subscriptions)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.orgId, orgId)));
}

export async function listSubscriptionDeliveries(subscriptionId: string) {
  const orgId = await getOrgId();
  return db
    .select({
      id: deliveries.id,
      eventId: deliveries.eventId,
      status: deliveries.status,
      attempts: deliveries.attempts,
      maxAttempts: deliveries.maxAttempts,
      lastError: deliveries.lastError,
      deliveredAt: deliveries.deliveredAt,
      createdAt: deliveries.createdAt,
      eventType: events.eventType,
      eventPayload: events.payload,
    })
    .from(deliveries)
    .innerJoin(events, eq(deliveries.eventId, events.id))
    .where(
      and(
        eq(deliveries.subscriptionId, subscriptionId),
        eq(deliveries.orgId, orgId),
      ),
    )
    .orderBy(desc(deliveries.createdAt))
    .limit(50);
}

export async function listWatchesForSubscription() {
  const orgId = await getOrgId();
  return db
    .select({
      id: watches.id,
      name: watches.name,
      schemaType: sql<string>`(SELECT schema_type FROM blueprints WHERE id = ${watches.blueprintId})`.as(
        "schema_type",
      ),
    })
    .from(watches)
    .where(and(eq(watches.orgId, orgId), isNull(watches.deletedAt)))
    .orderBy(watches.name);
}
