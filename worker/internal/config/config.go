package config

import (
	"fmt"
	"os"
)

// Config holds all worker configuration.
type Config struct {
	Port            string
	DatabaseURL     string
	WorkerAPIKey    string
	FirecrawlAPIKey string
	OpenAIAPIKey    string
	OpenAIModel     string
	ResendAPIKey    string
	ResendFromEmail string
}

// Load parses configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		Port:            getEnv("PORT", "8081"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		WorkerAPIKey:    os.Getenv("WORKER_API_KEY"),
		FirecrawlAPIKey: os.Getenv("FIRECRAWL_API_KEY"),
		OpenAIAPIKey:    os.Getenv("OPENAI_API_KEY"),
		OpenAIModel:     getEnv("OPENAI_MODEL", "gpt-4o-mini"),
		ResendAPIKey:    os.Getenv("RESEND_API_KEY"),
		ResendFromEmail: getEnv("RESEND_FROM_EMAIL", "Blueprinter <notifications@notify.blueprinter.io>"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.WorkerAPIKey == "" {
		return nil, fmt.Errorf("WORKER_API_KEY is required")
	}
	if cfg.FirecrawlAPIKey == "" {
		return nil, fmt.Errorf("FIRECRAWL_API_KEY is required")
	}
	if cfg.OpenAIAPIKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
