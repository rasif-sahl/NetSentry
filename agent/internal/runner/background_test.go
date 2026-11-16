//go:build !windows

package runner

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/securestore"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestBackgroundConsentChecksAreReadOnlyAndCurrent(t *testing.T) {
	id, wid := core.UUID(), core.UUID()
	var mu sync.Mutex
	allowed, generation, status, calls := true, 1, 200, 0
	count := func() int { mu.Lock(); defer mu.Unlock(); return calls }
	set := func(a bool, g, s int) { mu.Lock(); defer mu.Unlock(); allowed, generation, status = a, g, s }
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		calls++
		if r.Method != "GET" || r.URL.Path != "/agents/"+id+"/configuration" || r.Header.Get("Authorization") != "Bearer "+strings.Repeat("t", 43) {
			t.Errorf("unexpected preflight request")
		}
		if status != 200 {
			w.WriteHeader(status)
			return
		}
		c := configuration(id, wid, generation)
		c.BackgroundAllowed = allowed
		json.NewEncoder(w).Encode(c)
	}))
	defer server.Close()
	config := core.Config{APIURL: server.URL, DevelopmentStore: true}
	store := &memory{values: map[string]string{}}
	if err := securestore.SaveBinding(store, core.Binding{AgentID: id, WorkspaceID: wid, Generation: 1, Token: strings.Repeat("t", 43), APIURL: server.URL}); err != nil {
		t.Fatal(err)
	}
	if _, err := BackgroundConfiguration(context.Background(), config, store); err == nil || count() != 0 {
		t.Fatal("local denial contacted server")
	}
	config.BackgroundAllowed = true
	if _, err := BackgroundConfiguration(context.Background(), config, store); err != nil || count() != 1 {
		t.Fatal("valid preflight failed", err)
	}
	set(false, 1, 200)
	if _, err := BackgroundConfiguration(context.Background(), config, store); err == nil {
		t.Fatal("workspace denial allowed")
	}
	set(true, 2, 200)
	if _, err := BackgroundConfiguration(context.Background(), config, store); err == nil {
		t.Fatal("stale generation allowed")
	}
	set(true, 1, 503)
	if _, err := BackgroundConfiguration(context.Background(), config, store); err == nil {
		t.Fatal("outage allowed")
	}
	before := count()
	store.Delete("backend")
	if _, err := BackgroundConfiguration(context.Background(), config, store); err == nil || count() != before {
		t.Fatal("unpaired preflight allowed")
	}
}
func TestBackgroundStartupDoesNotStartLoopsBeforeGrant(t *testing.T) {
	id, wid := core.UUID(), core.UUID()
	var mu sync.Mutex
	methods := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		methods = append(methods, r.Method)
		c := configuration(id, wid, 1)
		c.BackgroundAllowed = false
		json.NewEncoder(w).Encode(c)
	}))
	defer server.Close()
	config := core.Config{APIURL: server.URL, DevelopmentStore: true, BackgroundAllowed: true, Requested: core.Modules{Network: true, Developer: true}}
	store := &memory{values: map[string]string{}}
	securestore.SaveBinding(store, core.Binding{AgentID: id, WorkspaceID: wid, Generation: 1, Token: strings.Repeat("t", 43), APIURL: server.URL})
	dir := filepath.Join(t.TempDir(), "agent")
	if err := core.PrivateDir(dir); err != nil {
		t.Fatal(err)
	}
	r, err := New(dir, config, store)
	if err != nil {
		t.Fatal(err)
	}
	if err = r.Run(context.Background(), true); err == nil {
		t.Fatal("unauthorized background run succeeded")
	}
	mu.Lock()
	defer mu.Unlock()
	if len(methods) != 1 || methods[0] != "GET" {
		t.Fatalf("background startup triggered workers/heartbeats: %v", methods)
	}
}
