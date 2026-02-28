package delivery

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const resendAPIURL = "https://api.resend.com/emails"

// ResendSender sends emails via the Resend HTTP API.
type ResendSender struct {
	apiKey    string
	fromEmail string
	client    *http.Client
}

// NewResendSender creates a new ResendSender.
func NewResendSender(apiKey, fromEmail string) *ResendSender {
	return &ResendSender{
		apiKey:    apiKey,
		fromEmail: fromEmail,
		client:    &http.Client{},
	}
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

type resendErrorResponse struct {
	StatusCode int    `json:"statusCode"`
	Name       string `json:"name"`
	Message    string `json:"message"`
}

// Send sends an email via the Resend API.
func (s *ResendSender) Send(ctx context.Context, req SendRequest) error {
	body := resendRequest{
		From:    s.fromEmail,
		To:      req.To,
		Subject: req.Subject,
		HTML:    req.HTMLBody,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshaling request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, resendAPIURL, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	respBody, _ := io.ReadAll(resp.Body)
	var errResp resendErrorResponse
	if json.Unmarshal(respBody, &errResp) == nil && errResp.Message != "" {
		return fmt.Errorf("resend API error (%d): %s", resp.StatusCode, errResp.Message)
	}
	return fmt.Errorf("resend API error (%d): %s", resp.StatusCode, string(respBody))
}
