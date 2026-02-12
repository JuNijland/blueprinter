import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getWatch,
  listWatchRuns,
  listWatchEntities,
} from "@/server/watches";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchActions } from "./actions";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  paused: "secondary",
  error: "destructive",
};

const runStatusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  running: "secondary",
  completed: "default",
  failed: "destructive",
};

export default async function WatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const watch = await getWatch(id);
  if (!watch) notFound();

  const [runs, entities] = await Promise.all([
    listWatchRuns(id),
    listWatchEntities(id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{watch.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{watch.url}</p>
        </div>
        <WatchActions watchId={watch.id} status={watch.status} />
      </div>

      {/* Info card */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={statusVariant[watch.status] ?? "secondary"}>
              {watch.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Blueprint</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/blueprints/${watch.blueprintId}`}
              className="text-sm font-medium hover:underline"
            >
              {watch.blueprintName ?? "Unknown"}
            </Link>
            {watch.blueprintSchemaType && (
              <p className="text-xs text-muted-foreground">
                {watch.blueprintSchemaType}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{watch.schedule}</p>
            {watch.nextRunAt && (
              <p className="text-xs text-muted-foreground">
                Next: {watch.nextRunAt.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Run</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {watch.lastRunAt
                ? watch.lastRunAt.toLocaleString()
                : "Never"}
            </p>
            {watch.lastError && (
              <p className="text-xs text-destructive truncate" title={watch.lastError}>
                {watch.lastError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for runs and entities */}
      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">
            Recent Runs ({runs.length})
          </TabsTrigger>
          <TabsTrigger value="entities">
            Entities ({entities.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runs" className="mt-4">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runs yet. Trigger a run or wait for the scheduler.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Found</TableHead>
                    <TableHead>New</TableHead>
                    <TableHead>Changed</TableHead>
                    <TableHead>Removed</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Badge
                          variant={
                            runStatusVariant[run.status] ?? "secondary"
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.startedAt.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.completedAt?.toLocaleString() ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.entitiesFound ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.entitiesNew ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.entitiesChanged ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {run.entitiesRemoved ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-destructive">
                        {run.errorMessage ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="entities" className="mt-4">
          {entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entities tracked yet. Run the watch to start extracting.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>External ID</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>First Seen</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Content</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell className="font-mono text-sm">
                        {entity.externalId.slice(0, 12)}...
                      </TableCell>
                      <TableCell className="text-sm">
                        {entity.schemaType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entity.status === "active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {entity.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entity.firstSeenAt.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entity.lastSeenAt.toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <pre className="truncate text-xs text-muted-foreground">
                          {JSON.stringify(entity.content)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
