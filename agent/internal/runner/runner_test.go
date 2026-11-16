//go:build !windows

package runner

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/remote"
	"netsentry.local/agent/internal/securestore"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type memory struct {
	mu     sync.Mutex
	values map[string]string
}

func (m *memory) Get(k string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.values[k]
	if !ok {
		return "", securestore.ErrNotFound
	}
	return v, nil
}
func (m *memory) Set(k, v string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.values[k] = v
	return nil
}
func (m *memory) Delete(k string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.values, k)
	return nil
}
func configuration(id, wid string, generation int) core.RemoteConfig {
	return core.RemoteConfig{SchemaVersion: 1, AgentID: id, WorkspaceID: wid, Generation: generation, Modules: core.Modules{Network: true, Developer: true}, HeartbeatSeconds: 30, MaxBufferedEvents: 1000, MaxBufferBytes: 1048576, MaxEventAgeSeconds: 86400, MaxBatchEvents: 50, MaxAttempts: 8, MaxBackoffSeconds: 300}
}
func TestReconnectScopeAndRevocation(t *testing.T) {
	id, wid := core.UUID(), core.UUID()
	generation := 1
	status := 200
	failSync := true
	received := []string{}
	var mu sync.Mutex
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if request.Header.Get("Authorization") != "Bearer "+strings.Repeat("a", 43) {
			t.Error("wrong outbound credential")
		}
		if status != 200 {
			w.WriteHeader(status)
			return
		}
		switch {
		case strings.HasSuffix(request.URL.Path, "/configuration"), strings.HasSuffix(request.URL.Path, "/heartbeat"):
			json.NewEncoder(w).Encode(configuration(id, wid, generation))
		case strings.HasSuffix(request.URL.Path, "/sync"):
			var body struct {
				Events []struct {
					EventID string `json:"eventId"`
				} `json:"events"`
			}
			json.NewDecoder(request.Body).Decode(&body)
			for _, e := range body.Events {
				received = append(received, e.EventID)
			}
			if failSync {
				w.WriteHeader(503)
				return
			}
			json.NewEncoder(w).Encode(map[string]int{"accepted": len(body.Events), "duplicates": 0})
		default:
			t.Error("unexpected request")
		}
	}))
	defer server.Close()
	dir := filepath.Join(t.TempDir(), "state")
	cfg, err := core.Initialize(dir, server.URL, true)
	if err != nil {
		t.Fatal(err)
	}
	cfg.Requested.Network = true
	store := &memory{values: map[string]string{}}
	securestore.SaveBinding(store, core.Binding{AgentID: id, WorkspaceID: wid, Generation: 1, Token: strings.Repeat("a", 43), APIURL: server.URL})
	r, err := New(dir, cfg, store)
	if err != nil {
		t.Fatal(err)
	}
	if err := r.Cycle(context.Background()); err == nil {
		t.Fatal("sync failure ignored")
	}
	before, _ := r.Queue.Batch(time.Now())
	if len(before) == 0 {
		t.Fatal("failed sync lost its buffer")
	}
	mu.Lock()
	failSync = false
	mu.Unlock()
	if err := r.Cycle(context.Background()); err != nil {
		t.Fatal(err)
	}
	snapshot := r.Snapshot()
	if !snapshot.Effective.Network || snapshot.Effective.Developer || snapshot.ServiceControlAvailable {
		t.Fatal("module isolation failed", snapshot)
	}
	mu.Lock()
	if received[0] != received[1] {
		t.Fatal("offline event identity changed")
	}
	generation = 2
	status = 503
	mu.Unlock()
	r.Queue.Add("CONNECTION_LOST", time.Now())
	if err := r.Cycle(context.Background()); err == nil {
		t.Fatal("outage ignored")
	}
	mu.Lock()
	status = 200
	mu.Unlock()
	if err := r.Cycle(context.Background()); err != nil {
		t.Fatal(err)
	}
	if r.binding.Generation != 2 {
		t.Fatal("generation not updated")
	}
	mu.Lock()
	status = 401
	mu.Unlock()
	if err := r.Cycle(context.Background()); err == nil {
		t.Fatal("revocation ignored")
	}
	snapshot = r.Snapshot()
	if snapshot.Paired || snapshot.BufferedEvents != 0 || snapshot.Connection != "revoked" {
		t.Fatal("revoked identity retained", snapshot)
	}
	if _, err := store.Get("backend"); err != securestore.ErrNotFound {
		t.Fatal("revoked credential retained")
	}
}
func TestRetryBudget(t *testing.T) {
	for attempt := 0; attempt < 20; attempt++ {
		delay := Delay(attempt)
		if delay < time.Second || delay > 300*time.Second {
			t.Fatal("retry bound violated", delay)
		}
	}
}
func TestRejectsUnsupportedConfig(t *testing.T) {
	id, wid := core.UUID(), core.UUID()
	binding := core.Binding{AgentID: id, WorkspaceID: wid}
	config := configuration(id, wid, 1)
	config.RemoteControlAllowed = true
	if remote.Validate(config, binding) == nil {
		t.Fatal("unexpected remote-control authorization accepted")
	}
	config.RemoteControlAllowed = false
	config.WorkspaceID = core.UUID()
	if remote.Validate(config, binding) == nil {
		t.Fatal("foreign workspace accepted")
	}
}
