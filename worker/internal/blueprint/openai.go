package blueprint

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// OpenAIClient generates extraction rules from cleaned HTML using OpenAI.
type OpenAIClient struct {
	apiKey     string
	model      string
	httpClient *http.Client
	logger     *slog.Logger
}

// NewOpenAIClient creates a new OpenAI client.
func NewOpenAIClient(apiKey, model string, logger *slog.Logger) *OpenAIClient {
	return &OpenAIClient{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
		logger: logger,
	}
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	Temperature    float64       `json:"temperature"`
	ResponseFormat *struct {
		Type string `json:"type"`
	} `json:"response_format,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// GenerateExtractionRules asks OpenAI to produce container + field XPath rules for the given schema.
func (c *OpenAIClient) GenerateExtractionRules(ctx context.Context, cleanedHTML string, schema EntitySchema) (*ExtractionRules, error) {
	c.logger.Info("generating extraction rules", "schema_type", schema.Type, "model", c.model)

	fieldsDesc := buildFieldsDescription(schema)

	systemPrompt := `You are an XPath expert for web scraping. Given cleaned HTML and a target entity schema, generate precise XPath extraction rules.

XPATH SYNTAX GUIDE:
- //tag[@class='name'] — find elements by exact class
- //tag[contains(@class, 'partial')] — partial class match
- //tag[@id='name'] — find by id
- .//child — relative to current element (MUST use for field XPaths)
- ./following-sibling::tag[1] — next sibling element
- //tag[@attribute='value'] — any attribute match

RULES:
1. "container" is an ABSOLUTE XPath that matches ALL entity items on the page (e.g. //div[@class='product-card'])
2. Each field XPath is RELATIVE to the container (MUST start with ./ or .//)
3. XPath expressions must be specific — avoid bare //div or //span
4. When data spans sibling rows, use ./following-sibling::
5. For prices, use "type": "integer" with "transform": "extract_integer" to get cents
6. For ratings, use "type": "number" with "transform": "extract_number"
7. For image URLs, use "attribute": "src"
8. For link URLs, use "attribute": "href"
9. Default "attribute" is "text" (extracts inner text)

OUTPUT FORMAT (JSON only):
{
  "container": "//absolute/xpath/to/each/entity",
  "fields": {
    "field_name": {
      "xpath": "./relative/xpath",
      "type": "string|integer|number",
      "attribute": "text|href|src|alt",
      "transform": "trim|extract_number|extract_integer"
    }
  }
}

EXAMPLE — product listing:
{
  "container": "//div[contains(@class, 'product-item')]",
  "fields": {
    "name": {"xpath": ".//h3[contains(@class, 'title')]", "type": "string", "attribute": "text"},
    "price": {"xpath": ".//span[contains(@class, 'price')]", "type": "integer", "attribute": "text", "transform": "extract_integer"},
    "currency": {"xpath": ".//span[contains(@class, 'currency')]", "type": "string", "attribute": "text"},
    "image_url": {"xpath": ".//img[contains(@class, 'product-image')]", "type": "string", "attribute": "src"},
    "seller": {"xpath": ".//span[contains(@class, 'seller')]", "type": "string", "attribute": "text"}
  }
}

EXAMPLE — data spanning sibling rows:
{
  "container": "//tr[contains(@class, 'athing')]",
  "fields": {
    "title": {"xpath": ".//span[@class='titleline']/a", "type": "string", "attribute": "text"},
    "url": {"xpath": ".//span[@class='titleline']/a", "type": "string", "attribute": "href"},
    "score": {"xpath": "./following-sibling::tr[1]//span[@class='score']", "type": "integer", "attribute": "text", "transform": "extract_integer"}
  }
}`

	userPrompt := fmt.Sprintf(`Analyze this HTML and generate extraction rules for the following entity type.

ENTITY SCHEMA:
%s

HTML TO ANALYZE:
%s

Generate the container XPath and field XPaths. Every field in the schema MUST have a corresponding entry in "fields". If a field cannot be found in the HTML, still include it with your best guess XPath.`, fieldsDesc, cleanedHTML)

	reqBody := chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: 0.1,
		ResponseFormat: &struct {
			Type string `json:"type"`
		}{Type: "json_object"},
	}

	respContent, err := c.chatCompletion(ctx, reqBody)
	if err != nil {
		return nil, fmt.Errorf("OpenAI chat completion: %w", err)
	}

	respContent = cleanJSONResponse(respContent)

	var rules ExtractionRules
	if err := json.Unmarshal([]byte(respContent), &rules); err != nil {
		return nil, fmt.Errorf("parsing extraction rules: %w (response: %.500s)", err, respContent)
	}

	if rules.Container == "" {
		return nil, fmt.Errorf("OpenAI returned empty container XPath")
	}
	if len(rules.Fields) == 0 {
		return nil, fmt.Errorf("OpenAI returned no field mappings")
	}

	c.logger.Info("extraction rules generated", "container", rules.Container, "fields", len(rules.Fields))
	return &rules, nil
}

func (c *OpenAIClient) chatCompletion(ctx context.Context, reqBody chatRequest) (string, error) {
	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshalling request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(reqJSON))
	if err != nil {
		return "", fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	var chatResp chatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("decoding response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no response from OpenAI")
	}

	return chatResp.Choices[0].Message.Content, nil
}

func buildFieldsDescription(schema EntitySchema) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Type: %s\nFields:\n", schema.Type))
	for _, f := range schema.Fields {
		sb.WriteString(fmt.Sprintf("- %s (%s): %s\n", f.Name, f.Type, f.Description))
	}
	return sb.String()
}

func cleanJSONResponse(content string) string {
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	return strings.TrimSpace(content)
}
