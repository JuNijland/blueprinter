"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateBlueprintStatus,
  deleteBlueprint,
} from "@/server/blueprints";

export function BlueprintActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    setLoading(true);
    await updateBlueprintStatus(id, "active");
    router.refresh();
    setLoading(false);
  }

  async function handleArchive() {
    setLoading(true);
    await updateBlueprintStatus(id, "archived");
    router.refresh();
    setLoading(false);
  }

  async function handleDelete() {
    setLoading(true);
    await deleteBlueprint(id);
    router.push("/dashboard/blueprints");
  }

  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <Button onClick={handleActivate} disabled={loading} size="sm">
          Activate
        </Button>
      )}
      {status === "active" && (
        <Button
          variant="outline"
          onClick={handleArchive}
          disabled={loading}
          size="sm"
        >
          Archive
        </Button>
      )}
      <Button
        variant="destructive"
        onClick={handleDelete}
        disabled={loading}
        size="sm"
      >
        Delete
      </Button>
    </div>
  );
}
