"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Trash2, RotateCw, Eye, AlertTriangle, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ActionMenuTrigger } from "@/components/ui/action-menu-trigger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pauseWatch, resumeWatch, deleteWatch, triggerWatchRun } from "@/server/watches";

export function WatchRunActions({
  errorMessage,
}: {
  errorMessage: string | null;
}) {
  const [errorOpen, setErrorOpen] = useState(false);

  if (!errorMessage) return null;

  return (
    <>
      <DropdownMenu>
        <ActionMenuTrigger />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setErrorOpen(true)}>
            <AlertTriangle className="mr-2 h-4 w-4" />
            View Error
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run Error</DialogTitle>
            <DialogDescription>Full error message from this run.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap break-words">
            {errorMessage}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EntityActions({
  externalId,
  content,
}: {
  externalId: string;
  content: unknown;
}) {
  const [contentOpen, setContentOpen] = useState(false);
  const formatted = JSON.stringify(content, null, 2);

  return (
    <>
      <DropdownMenu>
        <ActionMenuTrigger />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setContentOpen(true)}>
            <Eye className="mr-2 h-4 w-4" />
            View Content
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={contentOpen} onOpenChange={setContentOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entity Content</DialogTitle>
            <DialogDescription className="font-mono">{externalId}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[500px] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap break-words">
            {formatted}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WatchActions({ watchId, status }: { watchId: string; status: string }) {
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
        <DropdownMenuItem onClick={() => router.push(`/watches/${watchId}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={loading !== null}
          onClick={() =>
            handleAction(async () => {
              await triggerWatchRun(watchId);
            }, "trigger")
          }
        >
          <RotateCw className="mr-2 h-4 w-4" />
          {loading === "trigger" ? "Triggering..." : "Trigger Run"}
        </DropdownMenuItem>

        {status === "active" ? (
          <DropdownMenuItem
            disabled={loading !== null}
            onClick={() => handleAction(() => pauseWatch(watchId), "pause")}
          >
            <Pause className="mr-2 h-4 w-4" />
            {loading === "pause" ? "Pausing..." : "Pause"}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={loading !== null}
            onClick={() => handleAction(() => resumeWatch(watchId), "resume")}
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
              await deleteWatch(watchId);
              router.push("/watches");
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
