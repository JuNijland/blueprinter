package blueprint

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testHTML = `<html><body>
<div class="product">
  <h3 class="title">  Widget Pro  </h3>
  <span class="price">$29.99</span>
  <span class="count">42 reviews</span>
  <span class="euro-price">29,99</span>
  <span class="stock">In Stock</span>
  <a class="link" href="/product/1">Details</a>
</div>
<div class="product">
  <h3 class="title">  Gadget Basic  </h3>
  <span class="price">$9.50</span>
  <span class="count">7 reviews</span>
  <span class="euro-price">9,50</span>
  <span class="stock">Out of Stock</span>
  <a class="link" href="/product/2">Details</a>
</div>
</body></html>`

func TestExtract_DefaultString(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"name": {XPath: ".//h3[@class='title']", Type: "string", Attribute: "text"},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, "Widget Pro", entities[0]["name"])
	assert.Equal(t, "Gadget Basic", entities[1]["name"])
}

func TestExtract_DefaultInteger(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"review_count": {XPath: ".//span[@class='count']", Type: "integer", Attribute: "text"},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, int64(42), entities[0]["review_count"])
	assert.Equal(t, int64(7), entities[1]["review_count"])
}

func TestExtract_DefaultNumber(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"price": {XPath: ".//span[@class='price']", Type: "number", Attribute: "text"},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, 29.99, entities[0]["price"])
	assert.Equal(t, 9.50, entities[1]["price"])
}

func TestExtract_ExpressionTrim(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"name": {XPath: ".//h3[@class='title']", Type: "string", Attribute: "text", Expression: "trim(value)"},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, "Widget Pro", entities[0]["name"])
}

func TestExtract_ExpressionExtractNumber(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"price": {XPath: ".//span[@class='price']", Type: "number", Attribute: "text", Expression: "extractNumber(value)"},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, 29.99, entities[0]["price"])
}

func TestExtract_ExpressionExtractInteger(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"reviews": {XPath: ".//span[@class='count']", Type: "integer", Attribute: "text", Expression: "extractInteger(value)"},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, int64(42), entities[0]["reviews"])
}

func TestExtract_ExpressionEuropeanDecimalToCents(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"price_cents": {
				XPath:      ".//span[@class='euro-price']",
				Type:       "integer",
				Attribute:  "text",
				Expression: "int(extractNumber(replace(value, ',', '.')) * 100)",
			},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, int64(2999), entities[0]["price_cents"])
	assert.Equal(t, int64(950), entities[1]["price_cents"])
}

func TestExtract_ExpressionConditional(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"availability": {
				XPath:      ".//span[@class='stock']",
				Type:       "string",
				Attribute:  "text",
				Expression: "value contains 'In Stock' ? 'in_stock' : 'out_of_stock'",
			},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, "in_stock", entities[0]["availability"])
	assert.Equal(t, "out_of_stock", entities[1]["availability"])
}

func TestExtract_ExpressionHrefAttribute(t *testing.T) {
	rules := &ExtractionRules{
		Container: "//div[@class='product']",
		Fields: map[string]*FieldMapping{
			"url": {XPath: ".//a[@class='link']", Type: "string", Attribute: "href"},
		},
	}

	entities, err := Extract(testHTML, rules)
	require.NoError(t, err)
	require.Len(t, entities, 2)
	assert.Equal(t, "/product/1", entities[0]["url"])
	assert.Equal(t, "/product/2", entities[1]["url"])
}

func TestCompileExpressions_InvalidSyntax(t *testing.T) {
	fields := map[string]*FieldMapping{
		"bad": {XPath: ".//x", Type: "string", Expression: "((( invalid syntax"},
	}

	_, err := compileExpressions(fields)
	require.Error(t, err)
	assert.Contains(t, err.Error(), `compiling expression for field "bad"`)
}

func TestCompileExpressions_UnknownFunction(t *testing.T) {
	fields := map[string]*FieldMapping{
		"bad": {XPath: ".//x", Type: "string", Expression: "nonExistentFunc(value)"},
	}

	_, err := compileExpressions(fields)
	require.Error(t, err)
	assert.Contains(t, err.Error(), `compiling expression for field "bad"`)
}

func TestCompileExpressions_NoExpression(t *testing.T) {
	fields := map[string]*FieldMapping{
		"name": {XPath: ".//x", Type: "string"},
	}

	compiled, err := compileExpressions(fields)
	require.NoError(t, err)
	assert.Empty(t, compiled)
}

func TestCoerceResult(t *testing.T) {
	tests := []struct {
		name       string
		input      any
		targetType string
		expected   any
		wantErr    bool
	}{
		{"int to int64", int(42), "integer", int64(42), false},
		{"int64 to int64", int64(42), "integer", int64(42), false},
		{"float64 to int64", float64(42.7), "integer", int64(42), false},
		{"string to int64", "42", "integer", int64(42), false},
		{"float64 to float64", float64(3.14), "number", float64(3.14), false},
		{"int to float64", int(42), "number", float64(42), false},
		{"string to float64", "3.14", "number", float64(3.14), false},
		{"string to string", "hello", "string", "hello", false},
		{"int to string", int(42), "string", "42", false},
		{"float64 to string", float64(3.14), "string", "3.14", false},
		{"invalid string to int64", "abc", "integer", int64(0), true},
		{"bool to int64", true, "integer", int64(0), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := coerceResult(tt.input, tt.targetType)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}
