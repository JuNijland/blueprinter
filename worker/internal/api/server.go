package api

import (
	"log/slog"
	"net/http"
)

// NewServer creates a configured HTTP server with all routes and middleware.
func NewServer(port, apiKey string, h *Handlers, logger *slog.Logger) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", h.HandleHealth)
	mux.HandleFunc("POST /api/fetch-html", h.HandleFetchHTML)
	mux.HandleFunc("POST /api/generate-blueprint", h.HandleGenerateBlueprint)
	mux.HandleFunc("POST /api/test-blueprint", h.HandleTestBlueprint)
	mux.HandleFunc("POST /api/run-watch", h.HandleRunWatch)

	var handler http.Handler = mux
	handler = authMiddleware(apiKey, handler)
	handler = loggingMiddleware(logger, handler)

	return &http.Server{
		Addr:    ":" + port,
		Handler: handler,
	}
}
