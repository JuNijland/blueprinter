import { notFound } from "next/navigation";
import { getSubscription, listSubscriptionDeliveries } from "@/server/subscriptions";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Status, StatusIndicator, StatusLabel, type StatusType } from "@/components/ui/status";
import { SubscriptionActions } from "./actions";

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

function getDeliveryStatusType(status: string): StatusType {
  switch (status) {
    case "delivered":
      return "online";
    case "failed":
      return "offline";
    case "pending":
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

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subscription = await getSubscription(id);
  if (!subscription) notFound();

  const recentDeliveries = await listSubscriptionDeliveries(id);
  const config = subscription.channelConfig as { to?: string[] } | null;
  const recipients = config?.to ?? [];
  const filters = subscription.filters as { conditions?: { field: string; operator: string; value?: string }[] } | null;
  const conditions = filters?.conditions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{subscription.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subscription.watchName ? `Watch: ${subscription.watchName}` : "All watches"}
          </p>
        </div>
        <SubscriptionActions subscriptionId={subscription.id} status={subscription.status} />
      </div>

      <Card>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1">
              <Status status={getStatusType(subscription.status)}>
                <StatusIndicator />
                <StatusLabel>{getStatusLabel(subscription.status)}</StatusLabel>
              </Status>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Event Types</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {subscription.eventTypes.map((et) => (
                <Badge key={et} variant="secondary" className="text-xs">
                  {getEventTypeLabel(et)}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Filters</p>
            <div className="mt-1">
              {conditions.length === 0 ? (
                <p className="text-sm">All events</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {conditions.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {c.field} {c.operator}
                      {c.value ? ` = ${c.value}` : ""}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recipients</p>
            <div className="mt-1 space-y-0.5">
              {recipients.map((email) => (
                <p key={email} className="text-sm">
                  {email}
                </p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Deliveries */}
      <div>
        <h2 className="text-lg font-semibold">Recent Deliveries</h2>
        {recentDeliveries.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No deliveries yet. Deliveries are created when events match this subscription.
          </p>
        ) : (
          <div className="mt-2 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDeliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Status status={getDeliveryStatusType(d.status)}>
                        <StatusIndicator />
                        <StatusLabel>{getStatusLabel(d.status)}</StatusLabel>
                      </Status>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getEventTypeLabel(d.eventType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.attempts}/{d.maxAttempts}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.deliveredAt?.toLocaleString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.createdAt.toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {d.lastError ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
