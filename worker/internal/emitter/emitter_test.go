package emitter

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/blueprinter/worker/internal/differ"
)

func TestBuildAppearedPayload(t *testing.T) {
	d := differ.EntityDiff{
		ExternalID: "abc123",
		Type:       "appeared",
		Content: map[string]any{
			"name":         "Sony WH-1000XM5",
			"price":        29999,
			"currency":     "EUR",
			"availability": "in_stock",
		},
	}

	payload, err := buildAppearedPayload(d)
	require.NoError(t, err)

	var result appearedPayload
	err = json.Unmarshal(payload, &result)
	require.NoError(t, err)

	assert.Equal(t, "Sony WH-1000XM5", result.Entity["name"])
	assert.Equal(t, float64(29999), result.Entity["price"])
	assert.Equal(t, "EUR", result.Entity["currency"])
	assert.Equal(t, "in_stock", result.Entity["availability"])
}

func TestBuildChangedPayload(t *testing.T) {
	d := differ.EntityDiff{
		ExternalID: "abc123",
		Type:       "changed",
		Changes: []differ.FieldChange{
			{Field: "price", Old: 29999, New: 24999},
			{Field: "availability", Old: "in_stock", New: "low_stock"},
		},
		Content: map[string]any{
			"name":         "Sony WH-1000XM5",
			"price":        24999,
			"currency":     "EUR",
			"availability": "low_stock",
		},
	}

	payload, err := buildChangedPayload(d)
	require.NoError(t, err)

	var result changedPayload
	err = json.Unmarshal(payload, &result)
	require.NoError(t, err)

	assert.Len(t, result.Changes, 2)
	assert.Equal(t, "price", result.Changes[0].Field)
	assert.Equal(t, float64(29999), result.Changes[0].Old)
	assert.Equal(t, float64(24999), result.Changes[0].New)
	assert.Equal(t, "availability", result.Changes[1].Field)
	assert.Equal(t, "in_stock", result.Changes[1].Old)
	assert.Equal(t, "low_stock", result.Changes[1].New)

	assert.Equal(t, "Sony WH-1000XM5", result.Entity["name"])
	assert.Equal(t, float64(24999), result.Entity["price"])
}

func TestBuildDisappearedPayload(t *testing.T) {
	d := differ.EntityDiff{
		ExternalID: "abc123",
		Type:       "disappeared",
	}

	payload, err := buildDisappearedPayload(d)
	require.NoError(t, err)

	var result disappearedPayload
	err = json.Unmarshal(payload, &result)
	require.NoError(t, err)

	assert.Equal(t, "abc123", result.Entity["external_id"])
}

func TestBuildAppearedPayload_EmptyContent(t *testing.T) {
	d := differ.EntityDiff{
		ExternalID: "empty",
		Type:       "appeared",
		Content:    map[string]any{},
	}

	payload, err := buildAppearedPayload(d)
	require.NoError(t, err)

	var result appearedPayload
	err = json.Unmarshal(payload, &result)
	require.NoError(t, err)

	assert.Empty(t, result.Entity)
}

func TestBuildChangedPayload_SingleChange(t *testing.T) {
	d := differ.EntityDiff{
		ExternalID: "abc123",
		Type:       "changed",
		Changes: []differ.FieldChange{
			{Field: "price", Old: 2999, New: 2499},
		},
		Content: map[string]any{
			"name":  "Product X",
			"price": 2499,
		},
	}

	payload, err := buildChangedPayload(d)
	require.NoError(t, err)

	var result changedPayload
	err = json.Unmarshal(payload, &result)
	require.NoError(t, err)

	assert.Len(t, result.Changes, 1)
	assert.Equal(t, "price", result.Changes[0].Field)
	assert.Equal(t, "Product X", result.Entity["name"])
}
