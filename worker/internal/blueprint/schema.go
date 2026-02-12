package blueprint

var schemas = map[string]EntitySchema{
	"ecommerce_product": EcommerceProductSchema,
}

// EcommerceProductSchema is the pre-defined schema for e-commerce product listings.
var EcommerceProductSchema = EntitySchema{
	Type: "ecommerce_product",
	Fields: []FieldDef{
		{Name: "name", Type: "string", Description: "Product name/title"},
		{Name: "price", Type: "integer", Description: "Price in cents"},
		{Name: "currency", Type: "string", Description: "ISO currency code (e.g. EUR)"},
		{Name: "seller", Type: "string", Description: "Seller/merchant name"},
		{Name: "image_url", Type: "string", Description: "Product image URL"},
		{Name: "rating", Type: "number", Description: "Average rating (0-5)"},
		{Name: "review_count", Type: "integer", Description: "Number of reviews"},
		{Name: "availability", Type: "string", Description: "Stock status (in_stock, out_of_stock, etc.)"},
	},
}

// GetSchema returns the entity schema for the given type.
func GetSchema(schemaType string) (*EntitySchema, bool) {
	s, ok := schemas[schemaType]
	if !ok {
		return nil, false
	}
	return &s, true
}
