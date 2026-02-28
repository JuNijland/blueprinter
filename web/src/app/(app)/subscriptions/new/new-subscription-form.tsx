"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createSubscription } from "@/server/subscriptions";
import {
  getPresetsForSchemaType,
  presetToFilters,
  type SubscriptionPreset,
} from "@/lib/subscription-presets";

interface WatchOption {
  id: string;
  name: string;
  schemaType: string;
}

const EVENT_TYPES = [
  { value: "entity_appeared", label: "Entity Appeared" },
  { value: "entity_changed", label: "Entity Changed" },
  { value: "entity_disappeared", label: "Entity Disappeared" },
];

export function NewSubscriptionForm({ watches }: { watches: WatchOption[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [watchId, setWatchId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<SubscriptionPreset | null>(null);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState("");
  const [customEventTypes, setCustomEventTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedWatch = watches.find((w) => w.id === watchId);
  const presets = selectedWatch ? getPresetsForSchemaType(selectedWatch.schemaType) : [];

  function handleWatchChange(value: string) {
    setWatchId(value);
    setSelectedPreset(null);
  }

  function handlePresetSelect(preset: SubscriptionPreset) {
    setSelectedPreset(preset);
    setName(preset.label);
  }

  function toggleEventType(value: string) {
    setCustomEventTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const toEmails = emails
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (toEmails.length === 0) {
      setError("At least one email address is required");
      setSaving(false);
      return;
    }

    try {
      let eventTypes: string[];
      let filters: Record<string, unknown>;

      if (mode === "preset" && selectedPreset) {
        eventTypes = [...selectedPreset.eventTypes];
        filters = presetToFilters(selectedPreset.filters) as unknown as Record<string, unknown>;
      } else {
        eventTypes = customEventTypes;
        filters = { conditions: [] };
      }

      if (eventTypes.length === 0) {
        setError("At least one event type is required");
        setSaving(false);
        return;
      }

      const sub = await createSubscription({
        name: name.trim(),
        eventTypes,
        watchId: watchId || null,
        filters,
        channelConfig: { to: toEmails },
      });
      router.push(`/subscriptions/${sub.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subscription");
      setSaving(false);
    }
  }

  const isValid =
    name.trim() &&
    emails.trim() &&
    (mode === "preset" ? selectedPreset !== null : customEventTypes.length > 0);

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Subscription Configuration</CardTitle>
          <CardDescription>
            Choose a watch, pick a preset or build custom filters, and set recipients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          )}

          {/* Watch selector */}
          <div className="space-y-2">
            <Label>Watch (optional)</Label>
            <Select value={watchId} onValueChange={handleWatchChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All watches" />
              </SelectTrigger>
              <SelectContent>
                {watches.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Scope this subscription to a specific watch, or leave empty to match all.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "preset" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("preset")}
            >
              Use Preset
            </Button>
            <Button
              type="button"
              variant={mode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("custom")}
            >
              Custom
            </Button>
          </div>

          {/* Preset mode */}
          {mode === "preset" && (
            <div className="space-y-2">
              <Label>Preset</Label>
              {presets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {watchId
                    ? "No presets available for this watch's schema type."
                    : "Select a watch to see available presets."}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selectedPreset?.name === preset.name
                          ? "border-primary bg-primary/5"
                          : "hover:border-foreground/20"
                      }`}
                      onClick={() => handlePresetSelect(preset)}
                    >
                      <p className="text-sm font-medium">{preset.label}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {preset.eventTypes.map((et) => (
                          <Badge key={et} variant="secondary" className="text-xs">
                            {et.replace("entity_", "")}
                          </Badge>
                        ))}
                        {preset.filters.map((f, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {f.field}: {f.operator ?? "eq"}{f.new ? ` = ${f.new}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custom mode */}
          {mode === "custom" && (
            <div className="space-y-2">
              <Label>Event Types</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((et) => (
                  <button
                    key={et.value}
                    type="button"
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      customEventTypes.includes(et.value)
                        ? "border-primary bg-primary/5 font-medium"
                        : "hover:border-foreground/20"
                    }`}
                    onClick={() => toggleEventType(et.value)}
                  >
                    {et.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Subscription Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Price alerts for TechStore"
            />
          </div>

          {/* Email recipients */}
          <div className="space-y-2">
            <Label htmlFor="emails">Email Recipients</Label>
            <Input
              id="emails"
              type="text"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
            />
            <p className="text-xs text-muted-foreground">Comma-separated email addresses.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || saving}>
              {saving ? "Creating..." : "Create Subscription"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
