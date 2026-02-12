package blueprint

// ExtractionRules defines how to extract entities from HTML.
// Container is an absolute XPath to find all entity elements.
// Fields contains relative XPaths (starting with ./) for each field within the container.
type ExtractionRules struct {
	Container string                   `json:"container"`
	Fields    map[string]*FieldMapping `json:"fields"`
}

// FieldMapping describes how to extract a single field value.
type FieldMapping struct {
	XPath     string `json:"xpath"`
	Type      string `json:"type"`                // string, integer, number
	Attribute string `json:"attribute"`           // text, href, src, etc.
	Transform string `json:"transform,omitempty"` // trim, extract_number, extract_integer
}

// EntitySchema defines the expected shape of extracted entities.
type EntitySchema struct {
	Type   string     `json:"type"`
	Fields []FieldDef `json:"fields"`
}

// FieldDef describes a single field in an entity schema.
type FieldDef struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
}
