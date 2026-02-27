import { notFound } from "next/navigation";
import { getWatch } from "@/server/watches";
import { listBlueprints } from "@/server/blueprints";
import { EditWatchForm } from "./edit-watch-form";

export default async function EditWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [watch, blueprints] = await Promise.all([getWatch(id), listBlueprints()]);

  if (!watch) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Watch</h1>
        <p className="mt-1 text-muted-foreground">
          Update the configuration for this watch.
        </p>
      </div>
      <EditWatchForm
        watch={{
          id: watch.id,
          name: watch.name,
          url: watch.url,
          blueprintId: watch.blueprintId,
          schedule: watch.schedule,
        }}
        blueprints={blueprints.map((bp) => ({
          id: bp.id,
          name: bp.name,
          url: bp.url,
          schemaType: bp.schemaType,
        }))}
      />
    </div>
  );
}
