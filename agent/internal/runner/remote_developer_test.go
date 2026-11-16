//go:build !windows

package runner

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/securestore"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestRemoteConsentAndPendingPause(t *testing.T) {
	id, wid := core.UUID(), core.UUID()
	var configCalls, startCalls, resultCalls, pauseCalls atomic.Int32
	var shareAllowed atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/configuration"):
			configCalls.Add(1)
			json.NewEncoder(w).Encode(developerConfig{1, 1, 1, shareAllowed.Load(), core.Timestamp(time.Now())})
		case strings.HasSuffix(r.URL.Path, "/poll"):
			json.NewEncoder(w).Encode(map[string]any{"command": remoteCommand{ID: core.UUID(), AgentID: id, Generation: 1, Revision: 1, Mode: "graceful", LeaseToken: strings.Repeat("l", 43)}})
		case strings.HasSuffix(r.URL.Path, "/start"):
			startCalls.Add(1)
			json.NewEncoder(w).Encode(map[string]any{"allowed": true, "remainingMs": 9000})
		case strings.HasSuffix(r.URL.Path, "/result"):
			resultCalls.Add(1)
			json.NewEncoder(w).Encode(map[string]bool{"recorded": true})
		case strings.HasSuffix(r.URL.Path, "/pause"):
			pauseCalls.Add(1)
			json.NewEncoder(w).Encode(map[string]bool{"cleared": true})
		case strings.HasSuffix(r.URL.Path, "/snapshot"):
			json.NewEncoder(w).Encode(map[string]int{"accepted": 0})
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	config, err := core.Initialize(dir, server.URL, true)
	if err != nil {
		t.Fatal(err)
	}
	config.Requested.Developer = true
	config.LocalControlAllowed = true
	store := &memory{values: map[string]string{}}
	securestore.SaveBinding(store, core.Binding{AgentID: id, WorkspaceID: wid, Generation: 1, Token: strings.Repeat("a", 43), APIURL: server.URL})
	agent, err := New(dir, config, store)
	if err != nil {
		t.Fatal(err)
	}
	if err = agent.RemoteCycle(context.Background()); err != nil || configCalls.Load() != 0 {
		t.Fatal("default consent sent remote data", err)
	}
	if agent.RemotePreferences(true, true, false) == nil {
		t.Fatal("remote consent acceptance was inferred")
	}
	if err = agent.RemotePreferences(true, false, true); err != nil {
		t.Fatal(err)
	}
	if err = agent.RemoteCycle(context.Background()); err != nil || startCalls.Load() != 0 {
		t.Fatal("server sharing denial bypassed", err)
	}
	shareAllowed.Store(true)
	if err = agent.RemoteCycle(context.Background()); err != nil {
		t.Fatal(err)
	}
	if startCalls.Load() != 0 || resultCalls.Load() != 1 {
		t.Fatal("local shutdown permission enabled remote execution")
	}
	if err = agent.RemotePreferences(false, false, false); err != nil {
		t.Fatal(err)
	}
	if !agent.Config.RemotePausePending {
		t.Fatal("withdrawal did not invalidate pending work")
	}
	if err = agent.RemoteCycle(context.Background()); err != nil || pauseCalls.Load() != 1 || agent.Config.RemotePausePending {
		t.Fatal("disabled sharing failed to clear queued commands", err)
	}
}
