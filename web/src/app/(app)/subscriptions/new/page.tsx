import { listWatchesForSubscription } from "@/server/subscriptions";
import { NewSubscriptionForm } from "./new-subscription-form";

export default async function NewSubscriptionPage() {
  const watches = await listWatchesForSubscription();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Subscription</h1>
        <p className="mt-1 text-muted-foreground">
          Get notified when entities change on your watched pages.
        </p>
      </div>
      <NewSubscriptionForm
        watches={watches.map((w) => ({ id: w.id, name: w.name, schemaType: w.schemaType }))}
      />
    </div>
  );
}
