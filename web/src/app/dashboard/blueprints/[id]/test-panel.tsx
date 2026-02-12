"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { testBlueprintAction } from "@/server/blueprints";
import type { ExtractionRules } from "@/lib/types";

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

export function TestPanel({
  blueprintUrl,
  extractionRules,
  schemaType,
}: {
  blueprintUrl: string;
  extractionRules: ExtractionRules;
  schemaType: string;
}) {
  const [testUrl, setTestUrl] = useState(blueprintUrl);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(
    null
  );
  const [errors, setErrors] = useState<string[]>([]);

  async function handleTest() {
    setTesting(true);
    setErrors([]);
    setResults(null);

    try {
      const res = await testBlueprintAction(
        testUrl,
        extractionRules,
        schemaType
      );
      setResults(res.entities ?? []);
      setErrors(res.errors ?? []);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Test failed"]);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Blueprint</CardTitle>
        <CardDescription>
          Run this blueprint against a URL to verify extraction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="test-url">URL</Label>
            <Input
              id="test-url"
              type="url"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://example.com/products"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleTest}
              disabled={!testUrl.trim() || testing}
            >
              {testing ? "Testing..." : "Run Test"}
            </Button>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {results !== null && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              {results.length} entities found
            </p>
            {results.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {SCHEMA_FIELDS.map((field) => (
                        <TableHead key={field}>{field}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.slice(0, 20).map((entity, i) => (
                      <TableRow key={i}>
                        {SCHEMA_FIELDS.map((field) => (
                          <TableCell
                            key={field}
                            className="max-w-[200px] truncate text-sm"
                          >
                            {entity[field] != null
                              ? String(entity[field])
                              : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
