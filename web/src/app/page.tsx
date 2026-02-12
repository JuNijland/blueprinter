import Link from "next/link";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";

export default async function LandingPage() {
  const signInUrl = await getSignInUrl();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-4xl font-bold">Blueprinter</h1>
        <p className="text-lg text-muted-foreground">
          Event-driven data broker for monitoring web page changes
        </p>
      </div>
      <Link
        href={signInUrl}
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Sign in
      </Link>
    </div>
  );
}
