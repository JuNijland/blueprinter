import Link from "next/link";
import { listBlueprints } from "@/server/blueprints";
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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  active: "default",
  failed: "destructive",
  archived: "outline",
};

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
          <Link href="/dashboard/blueprints/new">New Blueprint</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No blueprints yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first blueprint to start extracting data from web pages.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/blueprints/new">Create Blueprint</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Schema</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((bp) => (
                <TableRow key={bp.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/blueprints/${bp.id}`}
                      className="font-medium hover:underline"
                    >
                      {bp.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                    {bp.url}
                  </TableCell>
                  <TableCell className="text-sm">{bp.schemaType}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[bp.status] ?? "secondary"}>
                      {bp.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {bp.createdAt.toLocaleDateString()}
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
