import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { headers } = await authkit(request, {
    eagerAuth: request.nextUrl.pathname !== "/" && !request.nextUrl.pathname.startsWith("/auth"),
  });

  return handleAuthkitHeaders(request, headers);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
