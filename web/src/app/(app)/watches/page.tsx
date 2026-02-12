import Link from "next/link";
import { listWatches } from "@/server/watches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  paused: "secondary",
  error: "destructive",
};

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
                <TableHead>URL</TableHead>
                <TableHead>Blueprint</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <Link
                      href={`/watches/${w.id}`}
                      className="font-medium hover:underline"
                    >
                      {w.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {w.url}
                  </TableCell>
                  <TableCell className="text-sm">
                    {w.blueprintName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{w.schedule}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[w.status] ?? "secondary"}>
                      {w.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {w.lastRunAt
                      ? w.lastRunAt.toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {w.createdAt.toLocaleDateString()}
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
