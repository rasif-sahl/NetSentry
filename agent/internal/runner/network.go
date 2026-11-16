package runner

import (
	"context"
	"errors"
	"net/netip"
	"net/url"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/modules/network"
	"netsentry.local/agent/internal/remote"
	"os"
	"path/filepath"
	"time"
)

type NetworkPreferences struct {
	Sharing   bool   `json:"sharing"`
	NetworkID string `json:"networkId"`
	Supported bool   `json:"supported"`
}
type networkConfiguration struct {
	SchemaVersion int                   `json:"schemaVersion"`
	NetworkID     string                `json:"networkId"`
	Generation    int                   `json:"generation"`
	Revision      int                   `json:"revision"`
	CIDRs         []string              `json:"cidrs"`
	Router        *network.RouterConfig `json:"router"`
	ServerTime    string                `json:"serverTime"`
}
type networkSnapshot struct {
	SchemaVersion int                   `json:"schemaVersion"`
	SnapshotID    string                `json:"snapshotId"`
	NetworkID     string                `json:"networkId"`
	Generation    int                   `json:"generation"`
	Revision      int                   `json:"revision"`
	ObservedAt    string                `json:"observedAt"`
	Interfaces    []network.Interface   `json:"interfaces"`
	Neighbors     []network.Neighbor    `json:"neighbors"`
	Router        *network.RouterResult `json:"router"`
}
type networkPending struct {
	AgentID  string          `json:"agentId"`
	Snapshot networkSnapshot `json:"snapshot"`
}

func (r *Runner) NetworkPreferences(sharing bool, id string, accepted bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if sharing && (!accepted || !core.ValidUUID(id)) {
		return errors.New("accept network-sharing-v1 and choose the network UUID")
	}
	next := r.Config
	next.NetworkPausePending = next.NetworkPausePending || (next.ShareNetwork && (!sharing || id != next.NetworkID))
	next.ShareNetwork = sharing
	if sharing {
		next.NetworkID = id
	} else {
		next.NetworkID = ""
	}
	if err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), next); err != nil {
		return err
	}
	r.Config = next
	return nil
}
func (r *Runner) NetworkStatus() NetworkPreferences {
	r.mu.Lock()
	defer r.mu.Unlock()
	return NetworkPreferences{r.Config.ShareNetwork, r.Config.NetworkID, network.Supported()}
}
func (r *Runner) clearNetworkPending() error {
	err := os.Remove(filepath.Join(r.Dir, "network-pending.json"))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
func (r *Runner) networkCurrent(binding core.Binding, config core.Config) bool {
	return r.binding.AgentID == binding.AgentID && r.binding.Generation == binding.Generation && r.Config.ShareNetwork && r.Config.Requested.Network && r.Config.NetworkID == config.NetworkID && !r.Config.NetworkPausePending
}
func (r *Runner) NetworkCycle(ctx context.Context) error {
	r.networkMu.Lock()
	defer r.networkMu.Unlock()
	r.mu.Lock()
	binding, config := r.binding, r.Config
	client := r.Client
	r.mu.Unlock()
	if binding.Token == "" {
		return nil
	}
	if config.NetworkPausePending {
		var result struct {
			Cleared bool `json:"cleared"`
		}
		if err := client.Request(ctx, "POST", "/agents/"+binding.AgentID+"/network/pause", binding.Token, struct{}{}, &result); err != nil {
			return err
		}
		if !result.Cleared {
			return errors.New("network pause not acknowledged")
		}
		r.mu.Lock()
		if r.binding.AgentID == binding.AgentID && r.Config.NetworkPausePending {
			r.Config.NetworkPausePending = false
			err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), r.Config)
			r.mu.Unlock()
			if err != nil {
				return err
			}
		} else {
			r.mu.Unlock()
		}
		if err := r.clearNetworkPending(); err != nil {
			return err
		}
		config.NetworkPausePending = false
	}
	if !config.ShareNetwork || !config.Requested.Network || !core.ValidUUID(config.NetworkID) {
		return nil
	}
	var grant networkConfiguration
	input := struct {
		NetworkID         string `json:"networkId"`
		Generation        int    `json:"generation"`
		Accepted          bool   `json:"accepted"`
		DisclosureVersion string `json:"disclosureVersion"`
	}{config.NetworkID, binding.Generation, true, "network-sharing-v1"}
	if err := client.Request(ctx, "POST", "/agents/"+binding.AgentID+"/network/configuration", binding.Token, input, &grant); err != nil {
		return err
	}
	if grant.SchemaVersion != 1 || grant.NetworkID != config.NetworkID || grant.Generation != binding.Generation || grant.Revision < 1 || network.ValidateScope(grant.CIDRs) != nil {
		return errors.New("invalid network authorization")
	}
	serverTime, err := time.Parse(core.TimeLayout, grant.ServerTime)
	if err != nil || time.Since(serverTime) > 10*time.Second || time.Until(serverTime) > 10*time.Second {
		return errors.New("network clock unavailable")
	}
	if !network.Supported() && r.networkDiscover == nil {
		return errors.New("network adapter unsupported")
	}
	var pending networkPending
	path := filepath.Join(r.Dir, "network-pending.json")
	if err := core.ReadPrivate(path, 65536, &pending); err != nil && !os.IsNotExist(err) {
		return err
	}
	stamp, e := time.Parse(core.TimeLayout, pending.Snapshot.ObservedAt)
	valid := e == nil && time.Since(stamp) >= 0 && time.Since(stamp) < 80*time.Second && pending.AgentID == binding.AgentID && pending.Snapshot.NetworkID == grant.NetworkID && pending.Snapshot.Generation == grant.Generation && pending.Snapshot.Revision == grant.Revision
	if !valid {
		discover := r.networkDiscover
		if discover == nil {
			discover = network.Discover
		}
		inventory, err := discover(ctx, grant.CIDRs)
		if err != nil {
			return errors.New("passive network metadata unavailable")
		}
		r.mu.Lock()
		current := r.networkCurrent(binding, config)
		r.mu.Unlock()
		if !current {
			return errors.New("network sharing changed during collection")
		}
		var router *network.RouterResult
		if grant.Router != nil {
			if !AllowedRouter(inventory, grant.Router.URL) {
				return errors.New("router is outside local authorized interfaces")
			}
			value := network.PollRouter(ctx, *grant.Router, grant.CIDRs)
			router = &value
		}
		pending = networkPending{binding.AgentID, networkSnapshot{1, core.UUID(), grant.NetworkID, grant.Generation, grant.Revision, core.Timestamp(time.Now()), inventory.Interfaces, inventory.Neighbors, router}}
		r.mu.Lock()
		current = r.networkCurrent(binding, config)
		if !current {
			r.mu.Unlock()
			return errors.New("network sharing withdrawn")
		}
		writeErr := core.WritePrivate(path, pending)
		r.mu.Unlock()
		if writeErr != nil {
			return writeErr
		}
	}
	r.mu.Lock()
	current := r.networkCurrent(binding, config)
	r.mu.Unlock()
	if !current {
		return errors.New("network sharing withdrawn")
	}
	var result struct {
		Accepted bool `json:"accepted"`
		Replayed bool `json:"replayed"`
	}
	err = client.Request(ctx, "POST", "/agents/"+binding.AgentID+"/network/snapshot", binding.Token, pending.Snapshot, &result)
	var failure *remote.Failure
	if errors.As(err, &failure) && (failure.Status == 400 || failure.Status == 401 || failure.Status == 403 || failure.Status == 409) {
		_ = r.clearNetworkPending()
	}
	if err != nil {
		return err
	}
	if !result.Accepted {
		return errors.New("network snapshot unconfirmed")
	}
	return r.clearNetworkPending()
}
func AllowedRouter(inventory network.Inventory, raw string) bool {
	u, e := url.Parse(raw)
	if e != nil {
		return false
	}
	ip, e := netip.ParseAddr(u.Hostname())
	if e != nil {
		return false
	}
	for _, iface := range inventory.Interfaces {
		p, e := netip.ParsePrefix(iface.CIDR)
		if e == nil && p.Contains(ip) {
			return true
		}
	}
	return false
}
func (r *Runner) networkLoop(ctx context.Context) {
	for {
		_ = r.NetworkCycle(ctx)
		timer := time.NewTimer(30 * time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}
