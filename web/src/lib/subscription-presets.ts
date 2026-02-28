/**
 * Subscription presets for ecommerce entities.
 * These map semantic user-facing labels to generic event_type + filter combinations.
 */

export type FilterOperator = "changed" | "increased" | "decreased" | "eq";

export interface PresetFilter {
  field: string;
  operator?: FilterOperator;
  new?: string;
}

export interface StoredCondition {
  field: string;
  operator: string;
  value?: string;
}

export interface StoredFilters {
  conditions: StoredCondition[];
}

export interface SubscriptionPreset {
  name: string;
  label: string;
  schemaType: string;
  eventTypes: string[];
  filters: PresetFilter[];
}

/**
 * Convert preset filters to the stored JSONB format used in the database.
 */
export function presetToFilters(presetFilters: PresetFilter[]): StoredFilters {
  if (presetFilters.length === 0) {
    return { conditions: [] };
  }

  const conditions: StoredCondition[] = presetFilters.map((f) => {
    if (f.new) {
      return { field: f.field, operator: "eq", value: f.new };
    }
    return { field: f.field, operator: f.operator ?? "changed" };
  });

  return { conditions };
}

/**
 * Get presets that match a given schema type.
 */
export function getPresetsForSchemaType(schemaType: string): SubscriptionPreset[] {
  return allPresets.filter((p) => p.schemaType === schemaType);
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
];

export const allPresets: SubscriptionPreset[] = [...ecommercePresets];
