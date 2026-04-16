// Package media manages publishing of reverse-connect streams into the
// existing go2rtc instance. All operations are idempotent and namespaced with
// a prefix (default "rv_") so they cannot collide with AION's existing streams.
package media

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Go2RTCBridge struct {
	baseURL string
	prefix  string
	http    *http.Client
}

func NewGo2RTCBridge(baseURL, prefix string) *Go2RTCBridge {
	if prefix == "" {
		prefix = "rv_"
	}
	return &Go2RTCBridge{
		baseURL: strings.TrimRight(baseURL, "/"),
		prefix:  prefix,
		http:    &http.Client{Timeout: 5 * time.Second},
	}
}

func (b *Go2RTCBridge) Prefix() string { return b.prefix }

// Ping verifies go2rtc is reachable.
func (b *Go2RTCBridge) Ping(ctx context.Context) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, b.baseURL+"/api", nil)
	resp, err := b.http.Do(req)
	if err != nil {
		return fmt.Errorf("go2rtc ping: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("go2rtc ping: status %d", resp.StatusCode)
	}
	return nil
}

// AddStream registers (or updates) a stream with the given name and source URL.
// go2rtc's PUT /api/streams accepts src + name query params.
func (b *Go2RTCBridge) AddStream(ctx context.Context, name, src string) error {
	if !strings.HasPrefix(name, b.prefix) {
		return fmt.Errorf("refusing to add stream without prefix %q: %s", b.prefix, name)
	}
	u := fmt.Sprintf("%s/api/streams?name=%s&src=%s", b.baseURL, name, src)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, u, nil)
	resp, err := b.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("go2rtc add stream: %d %s", resp.StatusCode, string(body))
	}
	return nil
}

// RemoveStream deletes a stream. Namespace-guarded.
func (b *Go2RTCBridge) RemoveStream(ctx context.Context, name string) error {
	if !strings.HasPrefix(name, b.prefix) {
		return fmt.Errorf("refusing to remove stream without prefix %q: %s", b.prefix, name)
	}
	u := fmt.Sprintf("%s/api/streams?src=%s", b.baseURL, name)
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, u, nil)
	resp, err := b.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("go2rtc remove: %d %s", resp.StatusCode, string(body))
	}
	return nil
}

// ListReverseStreams returns only the streams with our prefix.
// Used by the API and by cleanup routines.
func (b *Go2RTCBridge) ListReverseStreams(ctx context.Context) ([]string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, b.baseURL+"/api/streams", nil)
	resp, err := b.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var raw map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	out := make([]string, 0, 16)
	for k := range raw {
		if strings.HasPrefix(k, b.prefix) {
			out = append(out, k)
		}
	}
	return out, nil
}

// SanityCheckNamespace verifies we do NOT accidentally see go2rtc streams
// that existed before this gateway was deployed. Called once at startup.
// Logs any overlap but does not abort.
func (b *Go2RTCBridge) SanityCheckNamespace(ctx context.Context, knownExistingStreams []string) error {
	rv, err := b.ListReverseStreams(ctx)
	if err != nil {
		return err
	}
	known := make(map[string]struct{}, len(knownExistingStreams))
	for _, s := range knownExistingStreams {
		known[s] = struct{}{}
	}
	for _, name := range rv {
		if _, isKnown := known[name]; isKnown {
			// refuse to start: something is using our prefix.
			return fmt.Errorf("namespace collision: go2rtc already has stream %q in our reserved prefix", name)
		}
	}
	return nil
}

// postJSON is a helper kept here for future endpoints.
func (b *Go2RTCBridge) postJSON(ctx context.Context, path string, body any) error {
	buf, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, b.baseURL+path, bytes.NewReader(buf))
	req.Header.Set("content-type", "application/json")
	resp, err := b.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("go2rtc POST %s: %d", path, resp.StatusCode)
	}
	return nil
}
