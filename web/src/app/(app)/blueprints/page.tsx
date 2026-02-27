import Link from "next/link";
import { Calendar } from "lucide-react";
import { listBlueprints } from "@/server/blueprints";
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

function getBlueprintStatusType(status: string): StatusType {
  switch (status) {
    case "active":
      return "online";
    case "draft":
      return "maintenance";
    case "archived":
      return "offline";
    case "failed":
      return "offline";
    default:
      return "degraded";
  }
}

function getStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function BlueprintsPage() {
  const items = await listBlueprints();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blueprints</h1>
          <p className="mt-1 text-muted-foreground">
            Extraction rules for pulling structured entities from pages.
          </p>
        </div>
        <Button asChild>
          <Link href="/blueprints/new">New Blueprint</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No blueprints yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first blueprint to start extracting data from web pages.
          </p>
          <Button asChild className="mt-4">
            <Link href="/blueprints/new">Create Blueprint</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Schema</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((bp) => (
                <TableRow key={bp.id}>
                  <TableCell className="font-medium">
                    <Link href={`/blueprints/${bp.id}`} className="hover:underline">
                      {bp.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Status status={getBlueprintStatusType(bp.status)}>
                      <StatusIndicator />
                      <StatusLabel>{getStatusLabel(bp.status)}</StatusLabel>
                    </Status>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{bp.url}</span>
                  </TableCell>
                  <TableCell className="text-sm">{bp.schemaType}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {bp.createdAt.toLocaleDateString()}
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
