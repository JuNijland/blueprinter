export interface BlueprintOption {
  id: string;
  name: string;
  url: string;
  schemaType: string;
}

export const SCHEDULE_PRESETS = [
  { value: "*/15 * * * *", label: "Every 15 minutes" },
  { value: "*/30 * * * *", label: "Every 30 minutes" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 0 * * *", label: "Daily (midnight)" },
] as const;
