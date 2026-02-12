"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWatch } from "@/server/watches";

interface BlueprintOption {
  id: string;
  name: string;
  url: string;
  schemaType: string;
}

const SCHEDULE_PRESETS = [
  { value: "*/15 * * * *", label: "Every 15 minutes" },
  { value: "*/30 * * * *", label: "Every 30 minutes" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 0 * * *", label: "Daily (midnight)" },
] as const;

export function NewWatchForm({
  blueprints,
}: {
  blueprints: BlueprintOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [blueprintId, setBlueprintId] = useState("");
  const [schedule, setSchedule] = useState("0 * * * *");
  const [customSchedule, setCustomSchedule] = useState("");
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);
  const [identityFields, setIdentityFields] = useState("name");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleBlueprintChange(value: string) {
    setBlueprintId(value);
    const bp = blueprints.find((b) => b.id === value);
    if (bp && !url) {
      setUrl(bp.url);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const watch = await createWatch({
        blueprintId,
        name,
        url,
        schedule: useCustomSchedule ? customSchedule : schedule,
        identityFields: identityFields
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      });
      router.push(`/watches/${watch.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create watch");
      setSaving(false);
    }
  }

  const isValid =
    name.trim() &&
    url.trim() &&
    blueprintId &&
    (useCustomSchedule ? customSchedule.trim() : schedule);

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Watch Configuration</CardTitle>
          <CardDescription>
            Choose a blueprint, set the URL to monitor, and pick a schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Watch Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TechStore Product Prices"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blueprint">Blueprint</Label>
            {blueprints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No blueprints available. Create a blueprint first.
              </p>
            ) : (
              <Select value={blueprintId} onValueChange={handleBlueprintChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a blueprint" />
                </SelectTrigger>
                <SelectContent>
                  {blueprints.map((bp) => (
                    <SelectItem key={bp.id} value={bp.id}>
                      {bp.name} ({bp.schemaType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL to Monitor</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/products"
            />
          </div>

          <div className="space-y-2">
            <Label>Schedule</Label>
            {!useCustomSchedule ? (
              <div className="space-y-2">
                <Select value={schedule} onValueChange={setSchedule}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setUseCustomSchedule(true)}
                >
                  Use custom cron expression
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={customSchedule}
                  onChange={(e) => setCustomSchedule(e.target.value)}
                  placeholder="*/15 * * * *"
                />
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => setUseCustomSchedule(false)}
                >
                  Use preset schedule
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="identityFields">Identity Fields</Label>
            <Input
              id="identityFields"
              value={identityFields}
              onChange={(e) => setIdentityFields(e.target.value)}
              placeholder="name"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated field names used to uniquely identify each entity
              (e.g. &quot;name&quot; or &quot;name,seller&quot;).
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || saving}>
              {saving ? "Creating..." : "Create Watch"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
