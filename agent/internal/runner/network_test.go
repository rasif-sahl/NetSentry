//go:build !windows

package runner

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/modules/network"
	"netsentry.local/agent/internal/securestore"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestNetworkConsentReplayWithdrawalAndIsolation(t *testing.T) {
	id, wid, nid := core.UUID(), core.UUID(), core.UUID()
	var mu sync.Mutex
	requests, discoveries := 0, 0
	fail := true
	revision := 1
	var snapshots [][]byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		requests++
		switch req.URL.Path {
		case "/agents/" + id + "/network/configuration":
			json.NewEncoder(w).Encode(networkConfiguration{SchemaVersion: 1, NetworkID: nid, Generation: 1, Revision: revision, CIDRs: []string{"192.168.1.0/24"}, ServerTime: core.Timestamp(time.Now())})
		case "/agents/" + id + "/network/snapshot":
			raw, _ := io.ReadAll(req.Body)
			snapshots = append(snapshots, raw)
			if fail {
				w.WriteHeader(503)
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"accepted": true, "replayed": true})
		case "/agents/" + id + "/network/pause":
			json.NewEncoder(w).Encode(map[string]bool{"cleared": true})
		default:
			t.Errorf("unexpected path %s", req.URL.Path)
		}
	}))
	defer server.Close()
	dir := filepath.Join(t.TempDir(), "state")
	cfg, e := core.Initialize(dir, server.URL, true)
	if e != nil {
		t.Fatal(e)
	}
	cfg.Requested.Network = true
	store := &memory{values: map[string]string{}}
	if e = securestore.SaveBinding(store, core.Binding{AgentID: id, WorkspaceID: wid, Generation: 1, Token: "ttttttttttttttttttttttttttttttttttttttttttt", APIURL: server.URL}); e != nil {
		t.Fatal(e)
	}
	r, e := New(dir, cfg, store)
	if e != nil {
		t.Fatal(e)
	}
	r.networkDiscover = func(context.Context, []string) (network.Inventory, error) {
		discoveries++
		return network.Inventory{Interfaces: []network.Interface{{Name: "eth0", CIDR: "192.168.1.2/24"}}, Neighbors: []network.Neighbor{}}, nil
	}
	if e = r.NetworkCycle(context.Background()); e != nil || requests != 0 || discoveries != 0 {
		t.Fatal("default off collected", e)
	}
	if r.NetworkPreferences(true, nid, false) == nil || r.NetworkPreferences(true, "wrong", true) == nil {
		t.Fatal("accepted missing consent or ID")
	}
	if e = r.NetworkPreferences(true, nid, true); e != nil {
		t.Fatal(e)
	}
	if e = r.Run(context.Background(), true); e == nil || requests != 0 || discoveries != 0 {
		t.Fatal("background collection started without consent", e)
	}
	if e = r.NetworkCycle(context.Background()); e == nil {
		t.Fatal("lost acknowledgement ignored")
	}
	if discoveries != 1 {
		t.Fatal(discoveries)
	}
	if _, e = os.Stat(filepath.Join(dir, "network-pending.json")); e != nil {
		t.Fatal("pending lost", e)
	}
	mu.Lock()
	fail = false
	mu.Unlock()
	if e = r.NetworkCycle(context.Background()); e != nil {
		t.Fatal(e)
	}
	mu.Lock()
	if len(snapshots) != 2 || string(snapshots[0]) != string(snapshots[1]) {
		t.Fatal("retry changed payload")
	}
	mu.Unlock()
	if discoveries != 1 {
		t.Fatal("retry collected twice")
	}
	if r.Config.ShareServices || r.Config.LocalControlAllowed {
		t.Fatal("network enabled process control")
	}
	if e = r.NetworkPreferences(false, "", false); e != nil {
		t.Fatal(e)
	}
	before := requests
	if e = r.NetworkCycle(context.Background()); e != nil {
		t.Fatal(e)
	}
	if requests != before+1 || discoveries != 1 || r.Config.NetworkPausePending {
		t.Fatal("pause was not acknowledged while sharing off")
	}
	if e = r.NetworkCycle(context.Background()); e != nil || requests != before+1 {
		t.Fatal("off made API calls", e)
	}
}
func TestRouterMustBelongToLocalInterface(t *testing.T) {
	inventory := network.Inventory{Interfaces: []network.Interface{{Name: "eth0", CIDR: "192.168.1.20/24"}}}
	if !AllowedRouter(inventory, "https://192.168.1.1/ubus") || AllowedRouter(inventory, "https://192.168.2.1/ubus") {
		t.Fatal("scope")
	}
}

// TestNetworkAPIBridge is opt-in and compiled only into a test binary. Discovery is
// replaced here, never through a production CLI flag or runtime fixture mode.
func TestNetworkAPIBridge(t *testing.T) {
	path := os.Getenv("NETSENTRY_NETWORK_TEST_INPUT")
	if path == "" {
		t.Skip("live API bridge is opt-in")
	}
	var input struct {
		APIURL      string `json:"apiUrl"`
		AgentID     string `json:"agentId"`
		WorkspaceID string `json:"workspaceId"`
		NetworkID   string `json:"networkId"`
		Token       string `json:"token"`
	}
	raw, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	if e = json.Unmarshal(raw, &input); e != nil {
		t.Fatal(e)
	}
	dir := filepath.Join(t.TempDir(), "state")
	cfg, e := core.Initialize(dir, input.APIURL, true)
	if e != nil {
		t.Fatal(e)
	}
	cfg.Requested.Network = true
	store := &memory{values: map[string]string{}}
	if e = securestore.SaveBinding(store, core.Binding{AgentID: input.AgentID, WorkspaceID: input.WorkspaceID, Generation: 1, Token: input.Token, APIURL: input.APIURL}); e != nil {
		t.Fatal(e)
	}
	r, e := New(dir, cfg, store)
	if e != nil {
		t.Fatal(e)
	}
	calls := 0
	r.networkDiscover = func(context.Context, []string) (network.Inventory, error) {
		calls++
		mac := "02:00:00:00:00:01"
		return network.Inventory{Interfaces: []network.Interface{{Name: "fixture0", CIDR: "192.168.1.20/24"}}, Neighbors: []network.Neighbor{{Address: "192.168.1.50", MAC: &mac, Evidence: "cached"}}}, nil
	}
	if e = r.NetworkPreferences(true, input.NetworkID, true); e != nil {
		t.Fatal(e)
	}
	if e = r.NetworkCycle(context.Background()); e == nil {
		t.Fatal("expected intentionally lost snapshot acknowledgement")
	}
	if e = r.NetworkCycle(context.Background()); e != nil {
		t.Fatal(e)
	}
	if calls != 1 {
		t.Fatalf("lost acknowledgement recollected: %d", calls)
	}
	if _, e = os.Stat(filepath.Join(dir, "network-pending.json")); !os.IsNotExist(e) {
		t.Fatal("acknowledged pending snapshot retained")
	}
}
