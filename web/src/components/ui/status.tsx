"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType = "online" | "offline" | "maintenance" | "degraded";

export type StatusProps = ComponentProps<typeof Badge> & {
  status: StatusType;
};

export function Status({ className, status, ...props }: StatusProps) {
  return (
    <Badge
      className={cn("flex items-center gap-2", "group", status, className)}
      variant="secondary"
      {...props}
    />
  );
}

export function StatusIndicator(props: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className="relative flex h-2 w-2" {...props}>
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          "group-[.online]:bg-emerald-500",
          "group-[.offline]:bg-red-500",
          "group-[.maintenance]:bg-blue-500",
          "group-[.degraded]:bg-amber-500",
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          "group-[.online]:bg-emerald-500",
          "group-[.offline]:bg-red-500",
          "group-[.maintenance]:bg-blue-500",
          "group-[.degraded]:bg-amber-500",
        )}
      />
    </span>
  );
}

export function StatusLabel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-muted-foreground", className)} {...props}>
      {children}
    </span>
  );
}
