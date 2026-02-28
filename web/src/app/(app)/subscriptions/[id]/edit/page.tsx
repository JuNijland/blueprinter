import { notFound } from "next/navigation";
import { getSubscription, listWatchesForSubscription } from "@/server/subscriptions";
import { EditSubscriptionForm } from "./edit-subscription-form";

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [subscription, watches] = await Promise.all([
    getSubscription(id),
    listWatchesForSubscription(),
  ]);

  if (!subscription) notFound();

  const config = subscription.channelConfig as { to?: string[] } | null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Subscription</h1>
        <p className="mt-1 text-muted-foreground">
          Update the configuration for this subscription.
        </p>
      </div>
      <EditSubscriptionForm
        subscription={{
          id: subscription.id,
          name: subscription.name,
          eventTypes: subscription.eventTypes,
          watchId: subscription.watchId,
          filters: subscription.filters as Record<string, unknown>,
          channelConfig: { to: config?.to ?? [] },
        }}
        watches={watches}
      />
    </div>
  );
}
