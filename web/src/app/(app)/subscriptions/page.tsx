import Link from "next/link";
import { Calendar } from "lucide-react";
import { listSubscriptions } from "@/server/subscriptions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Status, StatusIndicator, StatusLabel, type StatusType } from "@/components/ui/status";
import { Badge } from "@/components/ui/badge";

function getStatusType(status: string): StatusType {
  switch (status) {
    case "active":
      return "online";
    case "paused":
      return "maintenance";
    default:
      return "degraded";
  }
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
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

export default async function SubscriptionsPage() {
  const items = await listSubscriptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="mt-1 text-muted-foreground">
            Route events to email notifications based on filters.
          </p>
        </div>
        <Button asChild>
          <Link href="/subscriptions/new">New Subscription</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No subscriptions yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a subscription to get notified when entities change.
          </p>
          <Button asChild className="mt-4">
            <Link href="/subscriptions/new">Create Subscription</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Event Types</TableHead>
                <TableHead>Watch</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => {
                const config = s.channelConfig as { to?: string[] } | null;
                const recipients = config?.to ?? [];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/subscriptions/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.eventTypes.map((et) => (
                          <Badge key={et} variant="secondary" className="text-xs">
                            {getEventTypeLabel(et)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.watchName ?? "All watches"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {recipients.length > 0 ? recipients.join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      <Status status={getStatusType(s.status)}>
                        <StatusIndicator />
                        <StatusLabel>{getStatusLabel(s.status)}</StatusLabel>
                      </Status>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {s.createdAt.toLocaleDateString()}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
