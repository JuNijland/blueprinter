import Link from "next/link";
import cronstrue from "cronstrue";
import { Calendar } from "lucide-react";
import { listWatches } from "@/server/watches";
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

function getWatchStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function WatchesPage() {
  const items = await listWatches();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Watches</h1>
          <p className="mt-1 text-muted-foreground">
            Scheduled jobs that periodically extract and diff entities from URLs.
          </p>
        </div>
        <Button asChild>
          <Link href="/watches/new">New Watch</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No watches yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first watch to start monitoring a page for changes.
          </p>
          <Button asChild className="mt-4">
            <Link href="/watches/new">Create Watch</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Blueprint</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <div>
                      <Link href={`/watches/${w.id}`} className="hover:underline">
                        {w.name}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-[250px] truncate">
                        {w.url}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Status status={getWatchStatusType(w.status)}>
                      <StatusIndicator />
                      <StatusLabel>{getWatchStatusLabel(w.status)}</StatusLabel>
                    </Status>
                  </TableCell>
                  <TableCell className="text-sm">{w.blueprintName ?? "—"}</TableCell>
                  <TableCell>
                    <p className="text-sm">{cronstrue.toString(w.schedule)}</p>
                    <p className="text-xs font-mono text-muted-foreground">{w.schedule}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {w.lastRunAt ? w.lastRunAt.toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {w.createdAt.toLocaleDateString()}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
