package delivery

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"strings"
)

var changedTmpl = template.Must(template.New("changed").Parse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a; margin-bottom: 4px;">Entity Changed</h2>
  <p style="color: #666; margin-top: 0;">Subscription: {{.SubscriptionName}}</p>
  {{if .EntityName}}<p style="color: #333;"><strong>{{.EntityName}}</strong></p>{{end}}
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Field</th>
        <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Old</th>
        <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">New</th>
      </tr>
    </thead>
    <tbody>
      {{range .Changes}}
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">{{.Field}}</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: #999;">{{.Old}}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: 600;">{{.New}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  <p style="color: #999; font-size: 12px;">Sent by Blueprinter</p>
</body>
</html>`))

var appearedTmpl = template.Must(template.New("appeared").Parse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a; margin-bottom: 4px;">New Entity Appeared</h2>
  <p style="color: #666; margin-top: 0;">Subscription: {{.SubscriptionName}}</p>
  {{if .EntityName}}<p style="color: #333;"><strong>{{.EntityName}}</strong></p>{{end}}
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Field</th>
        <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Value</th>
      </tr>
    </thead>
    <tbody>
      {{range .Fields}}
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">{{.Key}}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">{{.Value}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  <p style="color: #999; font-size: 12px;">Sent by Blueprinter</p>
</body>
</html>`))

var disappearedTmpl = template.Must(template.New("disappeared").Parse(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a; margin-bottom: 4px;">Entity Disappeared</h2>
  <p style="color: #666; margin-top: 0;">Subscription: {{.SubscriptionName}}</p>
  <p style="color: #333;">The entity <strong>{{.EntityID}}</strong> is no longer present on the monitored page.</p>
  <p style="color: #999; font-size: 12px;">Sent by Blueprinter</p>
</body>
</html>`))

type changeRow struct {
	Field string
	Old   string
	New   string
}

type fieldRow struct {
	Key   string
	Value string
}

// BuildEmailContent builds the email subject and HTML body for a delivery.
func BuildEmailContent(eventType string, payload []byte, subscriptionName string) (subject, htmlBody string, err error) {
	var parsed map[string]json.RawMessage
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return "", "", fmt.Errorf("parsing payload: %w", err)
	}

	entityName := extractEntityName(parsed)

	switch eventType {
	case "entity_changed":
		return buildChangedEmail(parsed, entityName, subscriptionName)
	case "entity_appeared":
		return buildAppearedEmail(parsed, entityName, subscriptionName)
	case "entity_disappeared":
		return buildDisappearedEmail(parsed, entityName, subscriptionName)
	default:
		return fmt.Sprintf("[Blueprinter] Event: %s", eventType), "<p>Unknown event type</p>", nil
	}
}

func buildChangedEmail(parsed map[string]json.RawMessage, entityName, subscriptionName string) (string, string, error) {
	subject := "[Blueprinter] Entity changed"
	if entityName != "" {
		subject = fmt.Sprintf("[Blueprinter] %s changed", entityName)
	}

	var changes []struct {
		Field string `json:"field"`
		Old   any    `json:"old"`
		New   any    `json:"new"`
	}
	if raw, ok := parsed["changes"]; ok {
		if err := json.Unmarshal(raw, &changes); err != nil {
			return "", "", fmt.Errorf("parsing changes: %w", err)
		}
	}

	rows := make([]changeRow, len(changes))
	for i, c := range changes {
		rows[i] = changeRow{
			Field: c.Field,
			Old:   fmt.Sprintf("%v", c.Old),
			New:   fmt.Sprintf("%v", c.New),
		}
	}

	// Build subject with field summary
	if len(changes) > 0 {
		fields := make([]string, len(changes))
		for i, c := range changes {
			fields[i] = c.Field
		}
		subject += " (" + strings.Join(fields, ", ") + ")"
	}

	var buf bytes.Buffer
	if err := changedTmpl.Execute(&buf, struct {
		SubscriptionName string
		EntityName       string
		Changes          []changeRow
	}{subscriptionName, entityName, rows}); err != nil {
		return "", "", fmt.Errorf("executing template: %w", err)
	}

	return subject, buf.String(), nil
}

func buildAppearedEmail(parsed map[string]json.RawMessage, entityName, subscriptionName string) (string, string, error) {
	subject := "[Blueprinter] New entity appeared"
	if entityName != "" {
		subject = fmt.Sprintf("[Blueprinter] New entity: %s", entityName)
	}

	var entity map[string]any
	if raw, ok := parsed["entity"]; ok {
		if err := json.Unmarshal(raw, &entity); err != nil {
			return "", "", fmt.Errorf("parsing entity: %w", err)
		}
	}

	var fields []fieldRow
	for k, v := range entity {
		fields = append(fields, fieldRow{Key: k, Value: fmt.Sprintf("%v", v)})
	}

	var buf bytes.Buffer
	if err := appearedTmpl.Execute(&buf, struct {
		SubscriptionName string
		EntityName       string
		Fields           []fieldRow
	}{subscriptionName, entityName, fields}); err != nil {
		return "", "", fmt.Errorf("executing template: %w", err)
	}

	return subject, buf.String(), nil
}

func buildDisappearedEmail(parsed map[string]json.RawMessage, entityName, subscriptionName string) (string, string, error) {
	entityID := entityName
	if entityID == "" {
		var entity map[string]any
		if raw, ok := parsed["entity"]; ok {
			if err := json.Unmarshal(raw, &entity); err == nil {
				if eid, ok := entity["external_id"].(string); ok {
					entityID = eid
				}
			}
		}
	}

	subject := "[Blueprinter] Entity disappeared"
	if entityID != "" {
		subject = fmt.Sprintf("[Blueprinter] %s disappeared", entityID)
	}

	var buf bytes.Buffer
	if err := disappearedTmpl.Execute(&buf, struct {
		SubscriptionName string
		EntityID         string
	}{subscriptionName, entityID}); err != nil {
		return "", "", fmt.Errorf("executing template: %w", err)
	}

	return subject, buf.String(), nil
}

func extractEntityName(parsed map[string]json.RawMessage) string {
	entityRaw, ok := parsed["entity"]
	if !ok {
		return ""
	}
	var entity map[string]any
	if err := json.Unmarshal(entityRaw, &entity); err != nil {
		return ""
	}
	if name, ok := entity["name"].(string); ok {
		return name
	}
	if eid, ok := entity["external_id"].(string); ok {
		return eid
	}
	return ""
}
