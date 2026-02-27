package blueprint

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/antchfx/htmlquery"
	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
	"golang.org/x/net/html"
)

// exprEnv is the environment passed to expr-lang expressions.
type exprEnv struct {
	Value string `expr:"value"`
}

// Extract applies extraction rules to HTML content and returns a slice of entity maps.
func Extract(htmlContent string, rules *ExtractionRules) ([]map[string]any, error) {
	compiled, err := compileExpressions(rules.Fields)
	if err != nil {
		return nil, err
	}

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
			value, err := extractField(container, mapping, compiled[fieldName])
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

// compileExpressions pre-compiles all field expressions once per Extract() call.
func compileExpressions(fields map[string]*FieldMapping) (map[string]*vm.Program, error) {
	opts := []expr.Option{
		expr.Env(exprEnv{}),
		expr.AsAny(),
		expr.Function("extractNumber", func(params ...any) (any, error) {
			s, ok := params[0].(string)
			if !ok {
				return nil, fmt.Errorf("extractNumber: expected string, got %T", params[0])
			}
			parsed, err := strconv.ParseFloat(extractNumericString(s), 64)
			if err != nil {
				return 0.0, nil
			}
			return parsed, nil
		}, new(func(string) float64)),
		expr.Function("extractInteger", func(params ...any) (any, error) {
			s, ok := params[0].(string)
			if !ok {
				return nil, fmt.Errorf("extractInteger: expected string, got %T", params[0])
			}
			parsed, err := strconv.ParseInt(extractIntegerString(s), 10, 64)
			if err != nil {
				return int(0), nil
			}
			return int(parsed), nil
		}, new(func(string) int)),
	}

	compiled := make(map[string]*vm.Program)
	for name, mapping := range fields {
		if mapping.Expression == "" {
			continue
		}
		program, err := expr.Compile(mapping.Expression, opts...)
		if err != nil {
			return nil, fmt.Errorf("compiling expression for field %q: %w", name, err)
		}
		compiled[name] = program
	}
	return compiled, nil
}

func extractField(node *html.Node, mapping *FieldMapping, program *vm.Program) (any, error) {
	rawValue, err := extractRawValue(node, mapping)
	if err != nil {
		return nil, err
	}

	// Expression path: evaluate and coerce
	if program != nil {
		result, err := expr.Run(program, exprEnv{Value: rawValue})
		if err != nil {
			return nil, fmt.Errorf("expression evaluation: %w", err)
		}
		return coerceResult(result, mapping.Type)
	}

	// Default path (no expression): type-based defaults
	switch mapping.Type {
	case "integer":
		s := extractIntegerString(rawValue)
		if s == "" {
			return int64(0), nil
		}
		return strconv.ParseInt(s, 10, 64)
	case "number":
		s := extractNumericString(rawValue)
		if s == "" {
			return 0.0, nil
		}
		return strconv.ParseFloat(s, 64)
	default:
		return strings.TrimSpace(rawValue), nil
	}
}

// extractRawValue pulls the raw string from an HTML node using XPath and attribute.
func extractRawValue(node *html.Node, mapping *FieldMapping) (string, error) {
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

	switch attr {
	case "text":
		return htmlquery.InnerText(found), nil
	case "html":
		return htmlquery.OutputHTML(found, true), nil
	default:
		return htmlquery.SelectAttr(found, attr), nil
	}
}

// coerceResult converts an expression result to the target field type.
func coerceResult(result any, targetType string) (any, error) {
	switch targetType {
	case "integer":
		return coerceToInt64(result)
	case "number":
		return coerceToFloat64(result)
	default:
		return coerceToString(result)
	}
}

func coerceToInt64(v any) (int64, error) {
	switch val := v.(type) {
	case int:
		return int64(val), nil
	case int64:
		return val, nil
	case float64:
		return int64(val), nil
	case string:
		return strconv.ParseInt(val, 10, 64)
	default:
		return 0, fmt.Errorf("cannot coerce %T to int64", v)
	}
}

func coerceToFloat64(v any) (float64, error) {
	switch val := v.(type) {
	case float64:
		return val, nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case string:
		return strconv.ParseFloat(val, 64)
	default:
		return 0, fmt.Errorf("cannot coerce %T to float64", v)
	}
}

func coerceToString(v any) (string, error) {
	switch val := v.(type) {
	case string:
		return val, nil
	case int:
		return strconv.Itoa(val), nil
	case int64:
		return strconv.FormatInt(val, 10), nil
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64), nil
	default:
		return fmt.Sprintf("%v", v), nil
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
