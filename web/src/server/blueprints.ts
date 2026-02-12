"use server";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { db } from "@/db";
import { blueprints } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import {
  workerFetchHtml,
  workerGenerateBlueprint,
  workerTestBlueprint,
} from "@/lib/worker-client";
import type { ExtractionRules } from "@/lib/types";

async function getOrgId(): Promise<string> {
  const { organizationId } = await withAuth({ ensureSignedIn: true });
  if (!organizationId) {
    throw new Error("No organization selected");
  }
  return organizationId;
}

// --- Worker calls ---

export async function fetchAndGenerateAction(url: string, schemaType: string) {
  const orgId = await getOrgId();
  const { cleaned_html } = await workerFetchHtml(orgId, url);
  return workerGenerateBlueprint(orgId, cleaned_html, schemaType);
}

export async function testBlueprintAction(
  url: string,
  extractionRules: ExtractionRules,
  schemaType: string
) {
  const orgId = await getOrgId();
  return workerTestBlueprint(orgId, url, extractionRules, schemaType);
}

// --- CRUD ---

export async function listBlueprints() {
  const orgId = await getOrgId();
  return db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.orgId, orgId), isNull(blueprints.deletedAt)))
    .orderBy(desc(blueprints.createdAt));
}

export async function getBlueprint(id: string) {
  const orgId = await getOrgId();
  const rows = await db
    .select()
    .from(blueprints)
    .where(
      and(
        eq(blueprints.id, id),
        eq(blueprints.orgId, orgId),
        isNull(blueprints.deletedAt)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createBlueprint(data: {
  name: string;
  url: string;
  schemaType: string;
  extractionRules: ExtractionRules;
}) {
  const orgId = await getOrgId();
  const rows = await db
    .insert(blueprints)
    .values({
      orgId,
      name: data.name,
      url: data.url,
      schemaType: data.schemaType,
      extractionRules: data.extractionRules,
    })
    .returning();
  return rows[0];
}

export async function updateBlueprintStatus(id: string, status: string) {
  const orgId = await getOrgId();
  await db
    .update(blueprints)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(blueprints.id, id), eq(blueprints.orgId, orgId)));
}

export async function deleteBlueprint(id: string) {
  const orgId = await getOrgId();
  await db
    .update(blueprints)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(blueprints.id, id), eq(blueprints.orgId, orgId)));
}
