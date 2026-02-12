import type { ExtractionRules } from "./types";

const WORKER_URL = process.env.WORKER_URL ?? "http://localhost:8081";
const WORKER_API_KEY = process.env.WORKER_API_KEY ?? "";

async function workerRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WORKER_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Worker request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function workerFetchHtml(
  orgId: string,
  url: string
): Promise<{ cleaned_html: string }> {
  return workerRequest("/api/fetch-html", { org_id: orgId, url });
}

export async function workerGenerateBlueprint(
  orgId: string,
  cleanedHtml: string,
  schemaType: string
): Promise<{ extraction_rules: ExtractionRules; test_results: Record<string, unknown>[] }> {
  return workerRequest("/api/generate-blueprint", {
    org_id: orgId,
    cleaned_html: cleanedHtml,
    schema_type: schemaType,
  });
}

export async function workerTestBlueprint(
  orgId: string,
  url: string,
  extractionRules: ExtractionRules,
  schemaType: string
): Promise<{ entities: Record<string, unknown>[]; errors: string[] }> {
  return workerRequest("/api/test-blueprint", {
    org_id: orgId,
    url,
    extraction_rules: extractionRules,
    schema_type: schemaType,
  });
}
