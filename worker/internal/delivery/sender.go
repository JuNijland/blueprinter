package delivery

import "context"

// SendRequest holds the data needed to send an email.
type SendRequest struct {
	To       []string
	Subject  string
	HTMLBody string
}

// Sender is the interface for sending email notifications.
type Sender interface {
	Send(ctx context.Context, req SendRequest) error
}
