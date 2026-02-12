package fetcher

import (
	"context"
	"fmt"
	"log/slog"

	firecrawl "github.com/mendableai/firecrawl-go"
)

// Client wraps the Firecrawl SDK for fetching rendered HTML.
type Client struct {
	app    *firecrawl.FirecrawlApp
	logger *slog.Logger
}

// NewClient creates a new Firecrawl fetcher client.
func NewClient(apiKey string, logger *slog.Logger) (*Client, error) {
	app, err := firecrawl.NewFirecrawlApp(apiKey, "https://api.firecrawl.dev")
	if err != nil {
		return nil, fmt.Errorf("creating Firecrawl client: %w", err)
	}
	return &Client{app: app, logger: logger}, nil
}

// FetchHTML fetches and returns the rendered HTML for a URL.
func (c *Client) FetchHTML(ctx context.Context, url string) (string, error) {
	c.logger.Info("fetching HTML via Firecrawl", "url", url)

	result, err := c.app.ScrapeURL(url, &firecrawl.ScrapeParams{
		Formats: []string{"html"},
	})
	if err != nil {
		return "", fmt.Errorf("scraping URL %q: %w", url, err)
	}

	if result.HTML == "" {
		return "", fmt.Errorf("Firecrawl returned empty HTML for %q", url)
	}

	c.logger.Info("HTML fetched", "url", url, "length", len(result.HTML))
	return result.HTML, nil
}
