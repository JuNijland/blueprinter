import { notFound } from "next/navigation";
import Link from "next/link";
import cronstrue from "cronstrue";
import { ExternalLink } from "lucide-react";
import { getWatch, listWatchRuns, listWatchEntities, listWatchEvents } from "@/server/watches";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Status, StatusIndicator, StatusLabel, type StatusType } from "@/components/ui/status";
import { WatchActions, WatchRunActions, EntityActions, EventActions } from "./actions";

function getWatchStatusType(status: string): StatusType {
  switch (status) {
    case "active":
      return "online";
    case "paused":
      return "maintenance";
    case "error":
      return "offline";
    default:
      return "degraded";
  }
}

function getRunStatusType(status: string): StatusType {
  switch (status) {
    case "completed":
      return "online";
    case "failed":
      return "offline";
    case "running":
      return "degraded";
    default:
      return "maintenance";
  }
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case "entity_appeared":
      return "Appeared";
    case "entity_changed":
      return "Changed";
    case "entity_disappeared":
      return "Disappeared";
    default:
      return eventType;
  }
}

function getEventTypeStatusType(eventType: string): StatusType {
  switch (eventType) {
    case "entity_appeared":
      return "online";
    case "entity_changed":
      return "degraded";
    case "entity_disappeared":
      return "offline";
    default:
      return "maintenance";
  }
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function WatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const watch = await getWatch(id);
  if (!watch) notFound();

  const [runs, entities, events] = await Promise.all([
    listWatchRuns(id),
    listWatchEntities(id),
    listWatchEvents(id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{watch.name}</h1>
          <a
            href={watch.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {watch.url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <WatchActions watchId={watch.id} status={watch.status} />
      </div>

      <Card>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1">
              <Status status={getWatchStatusType(watch.status)}>
                <StatusIndicator />
                <StatusLabel>{getStatusLabel(watch.status)}</StatusLabel>
              </Status>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Blueprint</p>
            <Link
              href={`/blueprints/${watch.blueprintId}`}
              className="mt-1 block text-sm font-medium hover:underline"
            >
              {watch.blueprintName ?? "Unknown"}
            </Link>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Schedule</p>
            <p className="mt-1 text-sm font-medium">{cronstrue.toString(watch.schedule)}</p>
            <p className="text-xs font-mono text-muted-foreground">{watch.schedule}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Run</p>
            <p className="mt-1 text-sm font-medium">
              {watch.lastRunAt ? watch.lastRunAt.toLocaleString() : "Never"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for runs and entities */}
      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Recent Runs ({runs.length})</TabsTrigger>
          <TabsTrigger value="entities">Entities ({entities.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
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
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Status status={getRunStatusType(run.status)}>
                          <StatusIndicator />
                          <StatusLabel>{getStatusLabel(run.status)}</StatusLabel>
                        </Status>
                      </TableCell>
                      <TableCell className="text-sm">{run.startedAt.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">
                        {run.completedAt?.toLocaleString() ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{run.entitiesFound ?? "—"}</TableCell>
                      <TableCell className="text-sm">{run.entitiesNew ?? "—"}</TableCell>
                      <TableCell className="text-sm">{run.entitiesChanged ?? "—"}</TableCell>
                      <TableCell className="text-sm">{run.entitiesRemoved ?? "—"}</TableCell>
                      <TableCell>
                        <WatchRunActions errorMessage={run.errorMessage} />
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
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entities.map((entity) => (
                    <TableRow key={entity.id}>
                      <TableCell className="font-mono text-sm">
                        {entity.externalId.slice(0, 12)}...
                      </TableCell>
                      <TableCell className="text-sm">{entity.schemaType}</TableCell>
                      <TableCell>
                        <Status status={entity.status === "active" ? "online" : "offline"}>
                          <StatusIndicator />
                          <StatusLabel>{getStatusLabel(entity.status)}</StatusLabel>
                        </Status>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entity.firstSeenAt.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entity.lastSeenAt.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <EntityActions externalId={entity.externalId} content={entity.content} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet. Events are emitted when entities appear, change, or disappear.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Occurred</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => {
                    const payload = event.payload as Record<string, unknown> | null;
                    const entity = payload?.entity as Record<string, unknown> | undefined;
                    const entityName =
                      (entity?.name as string) ?? (entity?.external_id as string) ?? "—";
                    const changes = payload?.changes as Record<string, unknown>[] | undefined;
                    const changeSummary = changes
                      ? changes.map((c) => c.field as string).join(", ")
                      : "—";

                    return (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Status status={getEventTypeStatusType(event.eventType)}>
                            <StatusIndicator />
                            <StatusLabel>{getEventTypeLabel(event.eventType)}</StatusLabel>
                          </Status>
                        </TableCell>
                        <TableCell className="text-sm">{entityName}</TableCell>
                        <TableCell className="text-sm">{changeSummary}</TableCell>
                        <TableCell className="text-sm">
                          {event.occurredAt.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <EventActions payload={event.payload} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
