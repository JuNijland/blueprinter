"use client";

import { Status, StatusIndicator, StatusLabel, type StatusType } from "@/components/ui/status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function getHealthStatusType(health: string): StatusType {
  switch (health) {
    case "operational":
      return "online";
    case "degraded":
      return "degraded";
    case "error":
      return "offline";
    default:
      return "online";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function HealthBadge({
  status,
  health,
  healthDetail,
}: {
  status: string;
  health: string;
  healthDetail: string;
}) {
  if (status === "paused") {
    return (
      <Status status="maintenance">
        <StatusIndicator />
        <StatusLabel>Paused</StatusLabel>
      </Status>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">
            <Status status={getHealthStatusType(health)}>
              <StatusIndicator />
              <StatusLabel>{capitalize(health)}</StatusLabel>
            </Status>
          </span>
        </TooltipTrigger>
        <TooltipContent>{healthDetail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
