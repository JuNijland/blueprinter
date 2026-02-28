"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Trash2, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ActionMenuTrigger } from "@/components/ui/action-menu-trigger";
import {
  pauseSubscription,
  resumeSubscription,
  deleteSubscription,
} from "@/server/subscriptions";

export function SubscriptionActions({
  subscriptionId,
  status,
}: {
  subscriptionId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: () => Promise<void>, actionName: string) {
    setLoading(actionName);
    try {
      await action();
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <ActionMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/subscriptions/${subscriptionId}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>

        {status === "active" ? (
          <DropdownMenuItem
            disabled={loading !== null}
            onClick={() => handleAction(() => pauseSubscription(subscriptionId), "pause")}
          >
            <Pause className="mr-2 h-4 w-4" />
            {loading === "pause" ? "Pausing..." : "Pause"}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={loading !== null}
            onClick={() => handleAction(() => resumeSubscription(subscriptionId), "resume")}
          >
            <Play className="mr-2 h-4 w-4" />
            {loading === "resume" ? "Resuming..." : "Resume"}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={loading !== null}
          onClick={() =>
            handleAction(async () => {
              await deleteSubscription(subscriptionId);
              router.push("/subscriptions");
            }, "delete")
          }
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {loading === "delete" ? "Deleting..." : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
