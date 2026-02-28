package filter

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// Condition represents a single filter condition.
type Condition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    any    `json:"value,omitempty"`
}

// Filters wraps a list of conditions (AND logic).
type Filters struct {
	Conditions []Condition `json:"conditions"`
}

// ParseFilters parses a JSONB filters column into Filters.
func ParseFilters(raw []byte) (Filters, error) {
	if len(raw) == 0 || string(raw) == "{}" || string(raw) == "null" {
		return Filters{}, nil
	}
	var f Filters
	if err := json.Unmarshal(raw, &f); err != nil {
		return Filters{}, fmt.Errorf("parsing filters: %w", err)
	}
	return f, nil
}

// Match evaluates whether an event matches the given filters.
// eventType: "entity_appeared", "entity_changed", "entity_disappeared"
// payload: the event's JSON payload
// Returns true if all conditions match (AND logic), or if there are no conditions.
func Match(eventType string, payload []byte, filters Filters) (bool, error) {
	if len(filters.Conditions) == 0 {
		return true, nil
	}

	// entity_disappeared always matches (filters are ignored)
	if eventType == "entity_disappeared" {
		return true, nil
	}

	var parsed map[string]json.RawMessage
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return false, fmt.Errorf("parsing payload: %w", err)
	}

	for _, c := range filters.Conditions {
		ok, err := evaluateCondition(eventType, parsed, c)
		if err != nil {
			return false, fmt.Errorf("evaluating condition %s/%s: %w", c.Field, c.Operator, err)
		}
		if !ok {
			return false, nil
		}
	}
	return true, nil
}

func evaluateCondition(eventType string, parsed map[string]json.RawMessage, c Condition) (bool, error) {
	switch eventType {
	case "entity_changed":
		return evaluateChangedCondition(parsed, c)
	case "entity_appeared":
		return evaluateAppearedCondition(parsed, c)
	default:
		return true, nil
	}
}

// evaluateChangedCondition checks against payload.changes[].
func evaluateChangedCondition(parsed map[string]json.RawMessage, c Condition) (bool, error) {
	changesRaw, ok := parsed["changes"]
	if !ok {
		return false, nil
	}

	var changes []struct {
		Field string `json:"field"`
		Old   any    `json:"old"`
		New   any    `json:"new"`
	}
	if err := json.Unmarshal(changesRaw, &changes); err != nil {
		return false, fmt.Errorf("parsing changes: %w", err)
	}

	for _, change := range changes {
		if change.Field != c.Field {
			continue
		}
		switch c.Operator {
		case "changed":
			return true, nil
		case "increased":
			return compareNumeric(change.Old, change.New, func(o, n float64) bool { return n > o })
		case "decreased":
			return compareNumeric(change.Old, change.New, func(o, n float64) bool { return n < o })
		case "eq":
			return valueEquals(change.New, c.Value), nil
		}
	}
	return false, nil
}

// evaluateAppearedCondition checks against payload.entity[field].
// Direction operators (increased, decreased, changed) pass automatically for appeared entities.
func evaluateAppearedCondition(parsed map[string]json.RawMessage, c Condition) (bool, error) {
	switch c.Operator {
	case "changed", "increased", "decreased":
		// Direction operators pass automatically for new entities
		return true, nil
	case "eq":
		entityRaw, ok := parsed["entity"]
		if !ok {
			return false, nil
		}
		var entity map[string]any
		if err := json.Unmarshal(entityRaw, &entity); err != nil {
			return false, fmt.Errorf("parsing entity: %w", err)
		}
		fieldVal, exists := entity[c.Field]
		if !exists {
			return false, nil
		}
		return valueEquals(fieldVal, c.Value), nil
	default:
		return false, nil
	}
}

// compareNumeric attempts to compare old and new values numerically.
func compareNumeric(old, new any, cmp func(float64, float64) bool) (bool, error) {
	oldF, okOld := toFloat64(old)
	newF, okNew := toFloat64(new)
	if !okOld || !okNew {
		return false, nil
	}
	return cmp(oldF, newF), nil
}

// toFloat64 converts a value to float64, handling JSON number types.
func toFloat64(v any) (float64, bool) {
	switch val := v.(type) {
	case float64:
		return val, true
	case float32:
		return float64(val), true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	case json.Number:
		f, err := val.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(val, 64)
		return f, err == nil
	default:
		return 0, false
	}
}

// valueEquals compares two values for equality after string normalization.
func valueEquals(a, b any) bool {
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}
