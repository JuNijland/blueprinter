/**
 * Subscription presets for ecommerce entities.
 * These map semantic user-facing labels to generic event_type + filter combinations.
 * Not wired up yet — prepared for future subscription UI.
 */

export type FilterOperator = "changed" | "increased" | "decreased";

export interface PresetFilter {
  field: string;
  operator?: FilterOperator;
  new?: string;
}

export interface SubscriptionPreset {
  name: string;
  label: string;
  schemaType: string;
  eventTypes: string[];
  filters: PresetFilter[];
}

export const ecommercePresets: SubscriptionPreset[] = [
  {
    name: "price_decreased",
    label: "Price decreased",
    schemaType: "ecommerce_product",
    eventTypes: ["entity_changed"],
    filters: [{ field: "price", operator: "decreased" }],
  },
  {
    name: "price_increased",
    label: "Price increased",
    schemaType: "ecommerce_product",
    eventTypes: ["entity_changed"],
    filters: [{ field: "price", operator: "increased" }],
  },
  {
    name: "availability_changed",
    label: "Availability changed",
    schemaType: "ecommerce_product",
    eventTypes: ["entity_changed"],
    filters: [{ field: "availability", operator: "changed" }],
  },
  {
    name: "back_in_stock",
    label: "Back in stock",
    schemaType: "ecommerce_product",
    eventTypes: ["entity_changed"],
    filters: [{ field: "availability", new: "in_stock" }],
  },
  {
    name: "new_product",
    label: "New product appeared",
    schemaType: "ecommerce_product",
    eventTypes: ["entity_appeared"],
    filters: [],
  },
  {
    name: "product_removed",
    label: "Product removed",
    schemaType: "ecommerce_product",
    eventTypes: ["entity_disappeared"],
    filters: [],
  },
] as const;
