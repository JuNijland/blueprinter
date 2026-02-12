package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/blueprinter/worker/internal/blueprint"
	"github.com/blueprinter/worker/internal/fetcher"
	"github.com/blueprinter/worker/internal/scheduler"
)

// Handlers holds dependencies for API handlers.
type Handlers struct {
	fetcher   *fetcher.Client
	openai    *blueprint.OpenAIClient
	scheduler *scheduler.Scheduler
	logger    *slog.Logger
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(fetcher *fetcher.Client, openai *blueprint.OpenAIClient, sched *scheduler.Scheduler, logger *slog.Logger) *Handlers {
	return &Handlers{
		fetcher:   fetcher,
		openai:    openai,
		scheduler: sched,
		logger:    logger,
	}
}

type fetchHTMLRequest struct {
	OrgID string `json:"org_id"`
	URL   string `json:"url"`
}

type fetchHTMLResponse struct {
	CleanedHTML string `json:"cleaned_html"`
}

type generateBlueprintRequest struct {
	OrgID       string `json:"org_id"`
	CleanedHTML string `json:"cleaned_html"`
	SchemaType  string `json:"schema_type"`
}

type generateBlueprintResponse struct {
	ExtractionRules *blueprint.ExtractionRules `json:"extraction_rules"`
	TestResults     []map[string]any           `json:"test_results"`
}

type testBlueprintRequest struct {
	OrgID           string                     `json:"org_id"`
	URL             string                     `json:"url"`
	ExtractionRules *blueprint.ExtractionRules `json:"extraction_rules"`
	SchemaType      string                     `json:"schema_type"`
}

type testBlueprintResponse struct {
	Entities []map[string]any `json:"entities"`
	Errors   []string         `json:"errors"`
}

// HandleHealth returns a simple health check response.
func (h *Handlers) HandleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// HandleFetchHTML fetches HTML via Firecrawl and returns both raw and cleaned versions.
func (h *Handlers) HandleFetchHTML(w http.ResponseWriter, r *http.Request) {
	var req fetchHTMLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if req.OrgID == "" || req.URL == "" {
		writeError(w, http.StatusBadRequest, "org_id and url are required")
		return
	}

	rawHTML, err := h.fetcher.FetchHTML(r.Context(), req.URL)
	if err != nil {
		h.logger.Error("fetch HTML failed", "url", req.URL, "error", err)
		writeError(w, http.StatusBadGateway, "failed to fetch HTML: "+err.Error())
		return
	}

	cleanedHTML, err := blueprint.Clean(rawHTML)
	if err != nil {
		h.logger.Error("clean HTML failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to clean HTML: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, fetchHTMLResponse{
		CleanedHTML: cleanedHTML})
}

// HandleGenerateBlueprint generates extraction rules from cleaned HTML using OpenAI.
func (h *Handlers) HandleGenerateBlueprint(w http.ResponseWriter, r *http.Request) {
	var req generateBlueprintRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if req.OrgID == "" || req.CleanedHTML == "" || req.SchemaType == "" {
		writeError(w, http.StatusBadRequest, "org_id, cleaned_html, and schema_type are required")
		return
	}

	schema, ok := blueprint.GetSchema(req.SchemaType)
	if !ok {
		writeError(w, http.StatusBadRequest, "unknown schema_type: "+req.SchemaType)
		return
	}

	rules, err := h.openai.GenerateExtractionRules(r.Context(), req.CleanedHTML, *schema)
	if err != nil {
		h.logger.Error("generate extraction rules failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to generate extraction rules: "+err.Error())
		return
	}

	// Validate by extracting from the same HTML
	testResults, err := blueprint.Extract(req.CleanedHTML, rules)
	if err != nil {
		h.logger.Warn("test extraction failed", "error", err)
		testResults = nil
	}

	writeJSON(w, http.StatusOK, generateBlueprintResponse{
		ExtractionRules: rules,
		TestResults:     testResults,
	})
}

// HandleTestBlueprint fetches a URL and extracts entities using provided rules.
func (h *Handlers) HandleTestBlueprint(w http.ResponseWriter, r *http.Request) {
	var req testBlueprintRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if req.OrgID == "" || req.URL == "" || req.ExtractionRules == nil {
		writeError(w, http.StatusBadRequest, "org_id, url, and extraction_rules are required")
		return
	}

	rawHTML, err := h.fetcher.FetchHTML(r.Context(), req.URL)
	if err != nil {
		h.logger.Error("fetch HTML failed", "url", req.URL, "error", err)
		writeError(w, http.StatusBadGateway, "failed to fetch HTML: "+err.Error())
		return
	}

	cleanedHTML, err := blueprint.Clean(rawHTML)
	if err != nil {
		h.logger.Error("clean HTML failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to clean HTML: "+err.Error())
		return
	}

	var errors []string
	entities, err := blueprint.Extract(cleanedHTML, req.ExtractionRules)
	if err != nil {
		errors = append(errors, err.Error())
	}

	writeJSON(w, http.StatusOK, testBlueprintResponse{
		Entities: entities,
		Errors:   errors,
	})
}

type runWatchRequest struct {
	OrgID   string `json:"org_id"`
	WatchID string `json:"watch_id"`
}

type runWatchResponse struct {
	RunID string `json:"run_id"`
}

// HandleRunWatch triggers a manual watch run.
func (h *Handlers) HandleRunWatch(w http.ResponseWriter, r *http.Request) {
	var req runWatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if req.OrgID == "" || req.WatchID == "" {
		writeError(w, http.StatusBadRequest, "org_id and watch_id are required")
		return
	}

	if h.scheduler == nil {
		writeError(w, http.StatusServiceUnavailable, "scheduler not available")
		return
	}

	runID, err := h.scheduler.RunSingle(r.Context(), req.WatchID)
	if err != nil {
		h.logger.Error("run watch failed", "watch_id", req.WatchID, "error", err)
		// Still return runID if we got one (run was created but execution failed)
		if runID != "" {
			writeJSON(w, http.StatusOK, runWatchResponse{RunID: runID})
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to run watch: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, runWatchResponse{RunID: runID})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
