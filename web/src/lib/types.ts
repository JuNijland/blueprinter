export interface FieldMapping {
  xpath: string;
  type: "string" | "integer" | "number";
  attribute: string;
  transform?: string;
}

export interface ExtractionRules {
  container: string;
  fields: Record<string, FieldMapping>;
}

export interface Blueprint {
  id: string;
  orgId: string;
  name: string;
  url: string;
  schemaType: string;
  extractionRules: ExtractionRules;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
