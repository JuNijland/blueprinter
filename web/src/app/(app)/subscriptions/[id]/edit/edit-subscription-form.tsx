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
import { updateSubscription } from "@/server/subscriptions";
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

interface EditSubscriptionFormProps {
  subscription: {
    id: string;
    name: string;
    eventTypes: string[];
    watchId: string | null;
    filters: Record<string, unknown>;
    channelConfig: { to: string[] };
  };
  watches: WatchOption[];
}

function hasMatchingPreset(
  presets: SubscriptionPreset[],
  eventTypes: string[],
  filters: Record<string, unknown>,
): SubscriptionPreset | null {
  const storedConditions = (filters as { conditions?: { field: string; operator: string; value?: string }[] })
    ?.conditions ?? [];

  for (const preset of presets) {
    if (
      preset.eventTypes.length === eventTypes.length &&
      preset.eventTypes.every((et) => eventTypes.includes(et))
    ) {
      const presetStored = presetToFilters(preset.filters);
      if (
        presetStored.conditions.length === storedConditions.length &&
        presetStored.conditions.every((pc, i) => {
          const sc = storedConditions[i];
          return sc && pc.field === sc.field && pc.operator === sc.operator && (pc.value ?? undefined) === (sc.value ?? undefined);
        })
      ) {
        return preset;
      }
    }
  }
  return null;
}

export function EditSubscriptionForm({ subscription, watches }: EditSubscriptionFormProps) {
  const router = useRouter();

  const selectedWatch = watches.find((w) => w.id === subscription.watchId);
  const presets = selectedWatch ? getPresetsForSchemaType(selectedWatch.schemaType) : [];
  const matchedPreset = hasMatchingPreset(presets, subscription.eventTypes, subscription.filters);

  const [watchId, setWatchId] = useState(subscription.watchId ?? "");
  const [mode, setMode] = useState<"preset" | "custom">(matchedPreset ? "preset" : "custom");
  const [selectedPreset, setSelectedPreset] = useState<SubscriptionPreset | null>(matchedPreset);
  const [name, setName] = useState(subscription.name);
  const [emails, setEmails] = useState(subscription.channelConfig.to.join(", "));
  const [customEventTypes, setCustomEventTypes] = useState<string[]>(subscription.eventTypes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentWatch = watches.find((w) => w.id === watchId);
  const currentPresets = currentWatch ? getPresetsForSchemaType(currentWatch.schemaType) : [];

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

      await updateSubscription(subscription.id, {
        name: name.trim(),
        eventTypes,
        watchId: watchId || null,
        filters,
        channelConfig: { to: toEmails },
      });
      router.push(`/subscriptions/${subscription.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscription");
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
              {currentPresets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {watchId
                    ? "No presets available for this watch's schema type."
                    : "Select a watch to see available presets."}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentPresets.map((preset) => (
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
            <Button type="button" variant="outline" onClick={() => router.push(`/subscriptions/${subscription.id}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
