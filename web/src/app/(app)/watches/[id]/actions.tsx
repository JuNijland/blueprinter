"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  pauseWatch,
  resumeWatch,
  deleteWatch,
  triggerWatchRun,
} from "@/server/watches";

export function WatchActions({
  watchId,
  status,
}: {
  watchId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAction(
    action: () => Promise<void>,
    actionName: string
  ) {
    setLoading(actionName);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${actionName} failed`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {status === "active" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() =>
              handleAction(() => pauseWatch(watchId), "Pausing")
            }
          >
            {loading === "Pausing" ? "Pausing..." : "Pause"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() =>
              handleAction(() => resumeWatch(watchId), "Resuming")
            }
          >
            {loading === "Resuming" ? "Resuming..." : "Resume"}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() =>
            handleAction(async () => {
              await triggerWatchRun(watchId);
            }, "Triggering")
          }
        >
          {loading === "Triggering" ? "Triggering..." : "Trigger Run"}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          disabled={loading !== null}
          onClick={() =>
            handleAction(async () => {
              await deleteWatch(watchId);
              router.push("/watches");
            }, "Deleting")
          }
        >
          {loading === "Deleting" ? "Deleting..." : "Delete"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
