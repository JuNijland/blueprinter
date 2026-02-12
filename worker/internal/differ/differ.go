package differ

import (
	"fmt"
	"strings"
)

// FieldChange describes a change in a single field.
type FieldChange struct {
	Field string `json:"field"`
	Old   any    `json:"old"`
	New   any    `json:"new"`
}

// EntityDiff describes the difference between two states of an entity.
type EntityDiff struct {
	ExternalID string        `json:"external_id"`
	Type       string        `json:"type"` // "appeared", "disappeared", "changed"
	Changes    []FieldChange `json:"changes,omitempty"`
	Content    map[string]any `json:"content,omitempty"` // full content for appeared entities
}

// DiffResult holds the complete result of comparing extracted vs stored entities.
type DiffResult struct {
	Appeared    []EntityDiff
	Disappeared []EntityDiff
	Changed     []EntityDiff
	Unchanged   int
}

// Diff compares extracted entities against stored entities, keyed by externalID.
// extracted: map[externalID] -> entity content
// stored: map[externalID] -> entity content
func Diff(extracted, stored map[string]map[string]any) DiffResult {
	var result DiffResult

	// Check for appeared and changed entities
	for eid, extractedContent := range extracted {
		storedContent, exists := stored[eid]
		if !exists {
			result.Appeared = append(result.Appeared, EntityDiff{
				ExternalID: eid,
				Type:       "appeared",
				Content:    extractedContent,
			})
			continue
		}

		changes := diffFields(storedContent, extractedContent)
		if len(changes) > 0 {
			result.Changed = append(result.Changed, EntityDiff{
				ExternalID: eid,
				Type:       "changed",
				Changes:    changes,
				Content:    extractedContent,
			})
		} else {
			result.Unchanged++
		}
	}

	// Check for disappeared entities
	for eid := range stored {
		if _, exists := extracted[eid]; !exists {
			result.Disappeared = append(result.Disappeared, EntityDiff{
				ExternalID: eid,
				Type:       "disappeared",
			})
		}
	}

	return result
}

// diffFields compares two entity maps field by field and returns changes.
func diffFields(old, new map[string]any) []FieldChange {
	var changes []FieldChange

	// Check all fields in new entity
	for field, newVal := range new {
		oldVal, exists := old[field]
		if !exists {
			changes = append(changes, FieldChange{Field: field, Old: nil, New: newVal})
			continue
		}
		if !valuesEqual(oldVal, newVal) {
			changes = append(changes, FieldChange{Field: field, Old: oldVal, New: newVal})
		}
	}

	// Check for removed fields (in old but not in new)
	for field, oldVal := range old {
		if _, exists := new[field]; !exists {
			changes = append(changes, FieldChange{Field: field, Old: oldVal, New: nil})
		}
	}

	return changes
}

// valuesEqual compares two values for equality.
// Strings are compared trimmed and case-sensitive.
// Numbers are compared exactly (both as float64 after normalization).
// Nil handling: nil == nil is true, nil != non-nil.
func valuesEqual(a, b any) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Normalize both to comparable types
	aStr, aIsStr := toString(a)
	bStr, bIsStr := toString(b)
	if aIsStr && bIsStr {
		return strings.TrimSpace(aStr) == strings.TrimSpace(bStr)
	}

	aNum, aIsNum := toFloat64(a)
	bNum, bIsNum := toFloat64(b)
	if aIsNum && bIsNum {
		return aNum == bNum
	}

	// Fall back to string comparison
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

func toString(v any) (string, bool) {
	switch val := v.(type) {
	case string:
		return val, true
	default:
		return "", false
	}
}

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
	case int32:
		return float64(val), true
	default:
		return 0, false
	}
}
