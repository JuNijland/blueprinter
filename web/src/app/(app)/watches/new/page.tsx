import { listBlueprints } from "@/server/blueprints";
import { NewWatchForm } from "./new-watch-form";

export default async function NewWatchPage() {
  const blueprints = await listBlueprints();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Watch</h1>
        <p className="mt-1 text-muted-foreground">
          Set up a scheduled job to monitor a page for entity changes.
        </p>
      </div>
      <NewWatchForm
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
