package filter

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMatch(t *testing.T) {
	tests := []struct {
		name      string
		eventType string
		payload   string
		filters   Filters
		want      bool
		wantErr   bool
	}{
		// --- Empty conditions ---
		{
			name:      "empty conditions match all",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":100,"new":90}],"entity":{"name":"Foo"}}`,
			filters:   Filters{},
			want:      true,
		},

		// --- entity_changed: changed operator ---
		{
			name:      "changed operator matches when field changed",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":100,"new":90}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "changed"}}},
			want:      true,
		},
		{
			name:      "changed operator no match when different field changed",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"name","old":"A","new":"B"}],"entity":{"name":"B"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "changed"}}},
			want:      false,
		},

		// --- entity_changed: decreased operator ---
		{
			name:      "decreased operator matches when price decreased",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":100,"new":90}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "decreased"}}},
			want:      true,
		},
		{
			name:      "decreased operator no match when price increased",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":90,"new":100}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "decreased"}}},
			want:      false,
		},

		// --- entity_changed: increased operator ---
		{
			name:      "increased operator matches when price increased",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":90,"new":100}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "increased"}}},
			want:      true,
		},
		{
			name:      "increased operator no match when price decreased",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":100,"new":90}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "increased"}}},
			want:      false,
		},

		// --- entity_changed: eq operator ---
		{
			name:      "eq operator matches when new value equals target",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"availability","old":"out_of_stock","new":"in_stock"}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "availability", Operator: "eq", Value: "in_stock"}}},
			want:      true,
		},
		{
			name:      "eq operator no match when new value differs",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"availability","old":"in_stock","new":"out_of_stock"}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "availability", Operator: "eq", Value: "in_stock"}}},
			want:      false,
		},

		// --- entity_appeared ---
		{
			name:      "appeared: direction operators pass automatically",
			eventType: "entity_appeared",
			payload:   `{"entity":{"name":"New Product","price":50}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "decreased"}}},
			want:      true,
		},
		{
			name:      "appeared: eq operator matches entity field",
			eventType: "entity_appeared",
			payload:   `{"entity":{"name":"New Product","availability":"in_stock"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "availability", Operator: "eq", Value: "in_stock"}}},
			want:      true,
		},
		{
			name:      "appeared: eq operator no match",
			eventType: "entity_appeared",
			payload:   `{"entity":{"name":"New Product","availability":"out_of_stock"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "availability", Operator: "eq", Value: "in_stock"}}},
			want:      false,
		},
		{
			name:      "appeared: eq operator field missing",
			eventType: "entity_appeared",
			payload:   `{"entity":{"name":"New Product"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "availability", Operator: "eq", Value: "in_stock"}}},
			want:      false,
		},

		// --- entity_disappeared ---
		{
			name:      "disappeared: filters always ignored",
			eventType: "entity_disappeared",
			payload:   `{"entity":{"external_id":"abc123"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "decreased"}}},
			want:      true,
		},
		{
			name:      "disappeared: empty filters match",
			eventType: "entity_disappeared",
			payload:   `{"entity":{"external_id":"abc123"}}`,
			filters:   Filters{},
			want:      true,
		},

		// --- AND logic ---
		{
			name:      "AND: all conditions must match",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":100,"new":90},{"field":"availability","old":"out_of_stock","new":"in_stock"}],"entity":{"name":"Foo"}}`,
			filters: Filters{Conditions: []Condition{
				{Field: "price", Operator: "decreased"},
				{Field: "availability", Operator: "eq", Value: "in_stock"},
			}},
			want: true,
		},
		{
			name:      "AND: fails if one condition fails",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":100,"new":90}],"entity":{"name":"Foo"}}`,
			filters: Filters{Conditions: []Condition{
				{Field: "price", Operator: "decreased"},
				{Field: "availability", Operator: "eq", Value: "in_stock"},
			}},
			want: false,
		},

		// --- String number parsing ---
		{
			name:      "decreased works with string numbers",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"price","old":"100","new":"90"}],"entity":{"name":"Foo"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "price", Operator: "decreased"}}},
			want:      true,
		},

		// --- Non-numeric comparison for direction operator ---
		{
			name:      "decreased fails with non-numeric values",
			eventType: "entity_changed",
			payload:   `{"changes":[{"field":"name","old":"Alpha","new":"Beta"}],"entity":{"name":"Beta"}}`,
			filters:   Filters{Conditions: []Condition{{Field: "name", Operator: "decreased"}}},
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Match(tt.eventType, []byte(tt.payload), tt.filters)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestParseFilters(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		want    Filters
		wantErr bool
	}{
		{
			name: "empty object",
			raw:  "{}",
			want: Filters{},
		},
		{
			name: "null",
			raw:  "null",
			want: Filters{},
		},
		{
			name: "empty bytes",
			raw:  "",
			want: Filters{},
		},
		{
			name: "single condition",
			raw:  `{"conditions":[{"field":"price","operator":"decreased"}]}`,
			want: Filters{Conditions: []Condition{{Field: "price", Operator: "decreased"}}},
		},
		{
			name: "condition with value",
			raw:  `{"conditions":[{"field":"availability","operator":"eq","value":"in_stock"}]}`,
			want: Filters{Conditions: []Condition{{Field: "availability", Operator: "eq", Value: "in_stock"}}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseFilters([]byte(tt.raw))
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
