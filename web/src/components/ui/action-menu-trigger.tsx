"use client";

import { forwardRef } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ActionMenuTriggerProps {
  icon?: LucideIcon;
}

export const ActionMenuTrigger = forwardRef<HTMLButtonElement, ActionMenuTriggerProps>(
  ({ icon: Icon = MoreHorizontal }, ref) => {
    return (
      <DropdownMenuTrigger asChild>
        <Button ref={ref} variant="ghost" size="sm">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
    );
  },
);

ActionMenuTrigger.displayName = "ActionMenuTrigger";
