import { notFound } from "next/navigation";
import { getBlueprint } from "@/server/blueprints";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BlueprintActions } from "./actions";
import { TestPanel } from "./test-panel";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  active: "default",
  failed: "destructive",
  archived: "outline",
};

export default async function BlueprintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bp = await getBlueprint(id);

  if (!bp) {
    notFound();
  }

  const rules = bp.extractionRules as {
    container: string;
    fields: Record<string, unknown>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{bp.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{bp.url}</p>
        </div>
        <BlueprintActions id={bp.id} status={bp.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusVariant[bp.status] ?? "secondary"}>{bp.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Schema Type</span>
              <span>{bp.schemaType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span>{bp.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{bp.createdAt.toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{bp.updatedAt.toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extraction Rules</CardTitle>
            <CardDescription>
              Container: <code>{rules.container}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto rounded bg-muted p-4 text-xs">
              {JSON.stringify(rules, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <TestPanel
        blueprintUrl={bp.url}
        extractionRules={bp.extractionRules as import("@/lib/types").ExtractionRules}
        schemaType={bp.schemaType}
      />
    </div>
  );
}
