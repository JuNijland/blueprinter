package differ

import (
	"testing"
)

func TestDiff(t *testing.T) {
	tests := []struct {
		name            string
		extracted       map[string]map[string]any
		stored          map[string]map[string]any
		wantAppeared    int
		wantDisappeared int
		wantChanged     int
		wantUnchanged   int
	}{
		{
			name: "all new entities",
			extracted: map[string]map[string]any{
				"a": {"name": "Product A", "price": float64(100)},
				"b": {"name": "Product B", "price": float64(200)},
			},
			stored:          map[string]map[string]any{},
			wantAppeared:    2,
			wantDisappeared: 0,
			wantChanged:     0,
			wantUnchanged:   0,
		},
		{
			name:      "all disappeared",
			extracted: map[string]map[string]any{},
			stored: map[string]map[string]any{
				"a": {"name": "Product A"},
				"b": {"name": "Product B"},
			},
			wantAppeared:    0,
			wantDisappeared: 2,
			wantChanged:     0,
			wantUnchanged:   0,
		},
		{
			name: "mixed: appeared, disappeared, changed, unchanged",
			extracted: map[string]map[string]any{
				"a": {"name": "Product A", "price": float64(150)}, // changed
				"b": {"name": "Product B", "price": float64(200)}, // unchanged
				"d": {"name": "Product D", "price": float64(400)}, // appeared
			},
			stored: map[string]map[string]any{
				"a": {"name": "Product A", "price": float64(100)}, // changed
				"b": {"name": "Product B", "price": float64(200)}, // unchanged
				"c": {"name": "Product C", "price": float64(300)}, // disappeared
			},
			wantAppeared:    1,
			wantDisappeared: 1,
			wantChanged:     1,
			wantUnchanged:   1,
		},
		{
			name: "field-level changes",
			extracted: map[string]map[string]any{
				"a": {"name": "Product A", "price": float64(200), "seller": "New Store"},
			},
			stored: map[string]map[string]any{
				"a": {"name": "Product A", "price": float64(100), "seller": "Old Store"},
			},
			wantAppeared:    0,
			wantDisappeared: 0,
			wantChanged:     1,
			wantUnchanged:   0,
		},
		{
			name: "null handling - field added",
			extracted: map[string]map[string]any{
				"a": {"name": "Product A", "price": float64(100)},
			},
			stored: map[string]map[string]any{
				"a": {"name": "Product A"},
			},
			wantAppeared:    0,
			wantDisappeared: 0,
			wantChanged:     1,
			wantUnchanged:   0,
		},
		{
			name: "null handling - field removed",
			extracted: map[string]map[string]any{
				"a": {"name": "Product A"},
			},
			stored: map[string]map[string]any{
				"a": {"name": "Product A", "price": float64(100)},
			},
			wantAppeared:    0,
			wantDisappeared: 0,
			wantChanged:     1,
			wantUnchanged:   0,
		},
		{
			name: "string trimming",
			extracted: map[string]map[string]any{
				"a": {"name": "  Product A  "},
			},
			stored: map[string]map[string]any{
				"a": {"name": "Product A"},
			},
			wantAppeared:    0,
			wantDisappeared: 0,
			wantChanged:     0,
			wantUnchanged:   1,
		},
		{
			name:            "both empty",
			extracted:       map[string]map[string]any{},
			stored:          map[string]map[string]any{},
			wantAppeared:    0,
			wantDisappeared: 0,
			wantChanged:     0,
			wantUnchanged:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Diff(tt.extracted, tt.stored)

			if len(result.Appeared) != tt.wantAppeared {
				t.Errorf("appeared: got %d, want %d", len(result.Appeared), tt.wantAppeared)
			}
			if len(result.Disappeared) != tt.wantDisappeared {
				t.Errorf("disappeared: got %d, want %d", len(result.Disappeared), tt.wantDisappeared)
			}
			if len(result.Changed) != tt.wantChanged {
				t.Errorf("changed: got %d, want %d", len(result.Changed), tt.wantChanged)
			}
			if result.Unchanged != tt.wantUnchanged {
				t.Errorf("unchanged: got %d, want %d", result.Unchanged, tt.wantUnchanged)
			}
		})
	}
}

func TestDiffFieldChanges(t *testing.T) {
	extracted := map[string]map[string]any{
		"a": {"name": "Product A", "price": float64(200), "seller": "New Store"},
	}
	stored := map[string]map[string]any{
		"a": {"name": "Product A", "price": float64(100), "seller": "Old Store"},
	}

	result := Diff(extracted, stored)
	if len(result.Changed) != 1 {
		t.Fatalf("expected 1 changed entity, got %d", len(result.Changed))
	}

	changes := result.Changed[0].Changes
	if len(changes) != 2 {
		t.Fatalf("expected 2 field changes, got %d", len(changes))
	}

	changeMap := make(map[string]FieldChange)
	for _, c := range changes {
		changeMap[c.Field] = c
	}

	priceChange, ok := changeMap["price"]
	if !ok {
		t.Fatal("expected price change")
	}
	if priceChange.Old != float64(100) || priceChange.New != float64(200) {
		t.Errorf("price change: got old=%v new=%v, want old=100 new=200", priceChange.Old, priceChange.New)
	}

	sellerChange, ok := changeMap["seller"]
	if !ok {
		t.Fatal("expected seller change")
	}
	if sellerChange.Old != "Old Store" || sellerChange.New != "New Store" {
		t.Errorf("seller change: got old=%v new=%v", sellerChange.Old, sellerChange.New)
	}
}

func TestValuesEqual(t *testing.T) {
	tests := []struct {
		name string
		a, b any
		want bool
	}{
		{"nil nil", nil, nil, true},
		{"nil string", nil, "hello", false},
		{"string nil", "hello", nil, false},
		{"same string", "hello", "hello", true},
		{"different string", "hello", "world", false},
		{"trimmed string", "  hello  ", "hello", true},
		{"same float", float64(42), float64(42), true},
		{"different float", float64(42), float64(43), false},
		{"int vs float", int(42), float64(42), true},
		{"int64 vs float", int64(42), float64(42), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := valuesEqual(tt.a, tt.b); got != tt.want {
				t.Errorf("valuesEqual(%v, %v) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}
