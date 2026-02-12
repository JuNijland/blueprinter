package blueprint

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/antchfx/htmlquery"
	"golang.org/x/net/html"
)

// Extract applies extraction rules to HTML content and returns a slice of entity maps.
func Extract(htmlContent string, rules *ExtractionRules) ([]map[string]any, error) {
	doc, err := htmlquery.Parse(strings.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("parsing HTML: %w", err)
	}

	containers, err := htmlquery.QueryAll(doc, rules.Container)
	if err != nil {
		return nil, fmt.Errorf("invalid container XPath %q: %w", rules.Container, err)
	}

	var entities []map[string]any
	for _, container := range containers {
		entity := make(map[string]any)
		for fieldName, mapping := range rules.Fields {
			value, err := extractField(container, mapping)
			if err != nil {
				continue
			}
			entity[fieldName] = value
		}
		if len(entity) > 0 {
			entities = append(entities, entity)
		}
	}

	return entities, nil
}

func extractField(node *html.Node, mapping *FieldMapping) (any, error) {
	switch mapping.Type {
	case "integer":
		return extractInteger(node, mapping)
	case "number":
		return extractNumber(node, mapping)
	default:
		return extractString(node, mapping)
	}
}

func extractString(node *html.Node, mapping *FieldMapping) (string, error) {
	found, err := htmlquery.Query(node, mapping.XPath)
	if err != nil {
		return "", fmt.Errorf("invalid XPath %q: %w", mapping.XPath, err)
	}
	if found == nil {
		return "", fmt.Errorf("XPath %q matched no elements", mapping.XPath)
	}

	attr := mapping.Attribute
	if attr == "" {
		attr = "text"
	}

	var value string
	switch attr {
	case "text":
		value = htmlquery.InnerText(found)
	case "html":
		value = htmlquery.OutputHTML(found, true)
	default:
		value = htmlquery.SelectAttr(found, attr)
	}

	return applyTransform(value, mapping.Transform), nil
}

func extractNumber(node *html.Node, mapping *FieldMapping) (float64, error) {
	strValue, err := extractString(node, mapping)
	if err != nil {
		return 0, err
	}

	if mapping.Transform == "" {
		strValue = applyTransform(strValue, "extract_number")
	}

	num, err := strconv.ParseFloat(strValue, 64)
	if err != nil {
		return 0, fmt.Errorf("parsing number from %q: %w", strValue, err)
	}
	return num, nil
}

func extractInteger(node *html.Node, mapping *FieldMapping) (int64, error) {
	strValue, err := extractString(node, mapping)
	if err != nil {
		return 0, err
	}

	if mapping.Transform == "" {
		strValue = applyTransform(strValue, "extract_integer")
	}

	num, err := strconv.ParseInt(strValue, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parsing integer from %q: %w", strValue, err)
	}
	return num, nil
}

func applyTransform(value, transform string) string {
	switch transform {
	case "trim":
		return strings.TrimSpace(value)
	case "lowercase":
		return strings.ToLower(value)
	case "uppercase":
		return strings.ToUpper(value)
	case "extract_number":
		return extractNumericString(value)
	case "extract_integer":
		return extractIntegerString(value)
	default:
		return strings.TrimSpace(value)
	}
}

func extractNumericString(s string) string {
	var result strings.Builder
	hasDecimal := false
	for _, ch := range s {
		if ch >= '0' && ch <= '9' {
			result.WriteRune(ch)
		} else if ch == '.' && !hasDecimal {
			result.WriteRune(ch)
			hasDecimal = true
		}
	}
	return result.String()
}

func extractIntegerString(s string) string {
	var result strings.Builder
	for _, ch := range s {
		if ch >= '0' && ch <= '9' {
			result.WriteRune(ch)
		}
	}
	return result.String()
}
