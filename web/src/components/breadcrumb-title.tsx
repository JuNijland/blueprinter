"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/sources": "Sources",
  "/blueprints": "Blueprints",
  "/watches": "Watches",
  "/events": "Events",
  "/subscriptions": "Subscriptions",
  "/settings": "Settings",
};

export function BreadcrumbTitle() {
  const pathname = usePathname();
  const segment = "/" + pathname.split("/").filter(Boolean)[0];
  const title = pageTitles[segment] ?? "Page";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
