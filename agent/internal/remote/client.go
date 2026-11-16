package remote

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"netsentry.local/agent/internal/buffer"
	"netsentry.local/agent/internal/core"
	"strings"
	"time"
)

type Failure struct {
	Status     int
	RetryAfter time.Duration
}

func (f *Failure) Error() string { return fmt.Sprintf("backend returned status %d", f.Status) }

type Client struct {
	Base string
	HTTP *http.Client
}

func New(base string, development bool) (*Client, error) {
	if err := core.CheckURL(base, development); err != nil {
		return nil, err
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	return &Client{Base: strings.TrimRight(base, "/"), HTTP: &http.Client{Transport: transport, Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}
func (c *Client) Request(ctx context.Context, method, path, token string, input, output any) error {
	var body io.Reader
	if input != nil {
		data, err := json.Marshal(input)
		if err != nil {
			return err
		}
		body = bytes.NewReader(data)
	}
	request, err := http.NewRequestWithContext(ctx, method, c.Base+path, body)
	if err != nil {
		return errors.New("invalid backend request")
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "NetSentry-Agent/"+core.Version)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := c.HTTP.Do(request)
	if err != nil {
		return errors.New("backend connection unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		after, err := time.ParseDuration(response.Header.Get("Retry-After") + "s")
		if err != nil || after < 0 {
			after = 0
		}
		if after > 300*time.Second {
			after = 300 * time.Second
		}
		return &Failure{response.StatusCode, after}
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 65537))
	if err != nil || len(data) > 65536 {
		return errors.New("invalid backend response size")
	}
	return core.StrictJSON(data, output)
}
func (c *Client) Configuration(ctx context.Context, binding core.Binding) (core.RemoteConfig, error) {
	var config core.RemoteConfig
	err := c.Request(ctx, "GET", "/agents/"+binding.AgentID+"/configuration", binding.Token, nil, &config)
	if err != nil {
		return config, err
	}
	return config, Validate(config, binding)
}
func Validate(config core.RemoteConfig, binding core.Binding) error {
	if !core.ValidUUID(config.AgentID) || !core.ValidUUID(config.WorkspaceID) || config.SchemaVersion != 1 || config.AgentID != binding.AgentID || config.WorkspaceID != binding.WorkspaceID || config.Generation < 1 || config.Generation < binding.Generation || config.RemoteControlAllowed || config.HeartbeatSeconds != 30 || config.MaxBatchEvents != 50 || config.MaxBufferedEvents != 1000 || config.MaxBufferBytes != 1048576 || config.MaxEventAgeSeconds != 86400 || config.MaxAttempts != 8 || config.MaxBackoffSeconds != 300 {
		return errors.New("unsupported or misattributed agent configuration")
	}
	return nil
}
func (c *Client) Sync(ctx context.Context, binding core.Binding, events []buffer.Event) error {
	var result struct {
		Accepted   int `json:"accepted"`
		Duplicates int `json:"duplicates"`
	}
	err := c.Request(ctx, "POST", "/agents/"+binding.AgentID+"/sync", binding.Token, struct {
		SchemaVersion int            `json:"schemaVersion"`
		Generation    int            `json:"generation"`
		Events        []buffer.Event `json:"events"`
	}{1, binding.Generation, events}, &result)
	if err == nil && result.Accepted+result.Duplicates != len(events) {
		return errors.New("backend did not acknowledge the complete batch")
	}
	return err
}
