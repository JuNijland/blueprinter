"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAndGenerateAction, createBlueprint } from "@/server/blueprints";
import type { ExtractionRules } from "@/lib/types";

type Step = "configure" | "generating" | "preview" | "save";

const SCHEMA_FIELDS = [
  "name",
  "price",
  "currency",
  "seller",
  "image_url",
  "rating",
  "review_count",
  "availability",
];

export default function NewBlueprintPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("configure");
  const [url, setUrl] = useState("");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [extractionRules, setExtractionRules] = useState<ExtractionRules | null>(null);
  const [testResults, setTestResults] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleGenerate() {
    setError("");
    setStep("generating");

    try {
      setProgress("Fetching page and generating extraction rules...");
      const result = await fetchAndGenerateAction(url, "ecommerce_product");

      setExtractionRules(result.extraction_rules);
      setTestResults(result.test_results ?? []);

      // Auto-suggest name from URL hostname
      try {
        const hostname = new URL(url).hostname.replace("www.", "");
        setName(`${hostname} products`);
      } catch {
        setName("New Blueprint");
      }

      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStep("configure");
    }
  }

  async function handleRegenerate() {
    setError("");
    setStep("generating");

    try {
      setProgress("Re-fetching and generating extraction rules...");
      const result = await fetchAndGenerateAction(url, "ecommerce_product");
      setExtractionRules(result.extraction_rules);
      setTestResults(result.test_results ?? []);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setStep("preview");
    }
  }

  async function handleSave() {
    if (!extractionRules) return;
    setSaving(true);
    setError("");

    try {
      const bp = await createBlueprint({
        name,
        url,
        schemaType: "ecommerce_product",
        extractionRules,
      });
      router.push(`/dashboard/blueprints/${bp.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Blueprint</h1>
        <p className="mt-1 text-muted-foreground">
          Generate extraction rules from a product listing page.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      {/* Step 1: Configure */}
      {step === "configure" && (
        <Card>
          <CardHeader>
            <CardTitle>Configure</CardTitle>
            <CardDescription>Enter the URL of a product listing page to analyze.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Page URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/products"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Schema Type</Label>
              <Input value="E-commerce Product" disabled />
            </div>
            <Button onClick={handleGenerate} disabled={!url.trim()}>
              Fetch &amp; Generate
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Generating */}
      {step === "generating" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{progress}</p>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && extractionRules && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Extraction Preview</CardTitle>
              <CardDescription>
                {testResults.length} entities extracted from the page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {SCHEMA_FIELDS.map((field) => (
                          <TableHead key={field}>{field}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testResults.slice(0, 10).map((entity, i) => (
                        <TableRow key={i}>
                          {SCHEMA_FIELDS.map((field) => (
                            <TableCell key={field} className="max-w-[200px] truncate text-sm">
                              {entity[field] != null ? String(entity[field]) : "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No entities were extracted. Try re-generating.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extraction Rules</CardTitle>
              <CardDescription>
                Container: <code>{extractionRules.container}</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-4 text-xs">
                {JSON.stringify(extractionRules, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRegenerate}>
              Re-generate
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep("configure");
                setExtractionRules(null);
                setTestResults([]);
              }}
            >
              Start Over
            </Button>
            <Button onClick={() => setStep("save")}>Save Blueprint</Button>
          </div>
        </div>
      )}

      {/* Step 4: Save */}
      {step === "save" && (
        <Card>
          <CardHeader>
            <CardTitle>Save Blueprint</CardTitle>
            <CardDescription>Give your blueprint a name and save it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Blueprint Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Blueprint"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("preview")} disabled={saving}>
                Back
              </Button>
              <Button onClick={handleSave} disabled={!name.trim() || saving}>
                {saving ? "Saving..." : "Save Blueprint"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
