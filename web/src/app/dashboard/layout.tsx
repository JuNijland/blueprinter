import { redirect } from "next/navigation";
import {
  withAuth,
  signOut,
  switchToOrganization,
  getWorkOS,
} from "@workos-inc/authkit-nextjs";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardBreadcrumb } from "@/components/dashboard-breadcrumb";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, organizationId } = await withAuth({ ensureSignedIn: true });

  if (!user) {
    redirect("/");
  }

  const workos = getWorkOS();

  // Fetch user's org memberships and current org in parallel
  const [membershipsResponse, currentOrg] = await Promise.all([
    workos.userManagement.listOrganizationMemberships({
      userId: user.id,
      statuses: ["active"],
    }),
    organizationId
      ? workos.organizations.getOrganization(organizationId)
      : null,
  ]);

  const organizations = membershipsResponse.data.map((m) => ({
    id: m.organizationId,
    name: m.organizationName,
  }));

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  async function handleSwitchOrganization(orgId: string) {
    "use server";
    await switchToOrganization(orgId);
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        }}
        currentOrganization={
          currentOrg ? { id: currentOrg.id, name: currentOrg.name } : null
        }
        organizations={organizations}
        signOutAction={handleSignOut}
        switchOrganizationAction={handleSwitchOrganization}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <DashboardBreadcrumb />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
