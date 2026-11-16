package runner

import (
	"context"
	"errors"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/modules/developer"
	"netsentry.local/agent/internal/remote"
	"os"
	"path/filepath"
	"time"
)

type DeveloperPreferences struct {
	Sharing   bool `json:"sharing"`
	Control   bool `json:"control"`
	Supported bool `json:"supported"`
}
type developerConfig struct {
	SchemaVersion  int    `json:"schemaVersion"`
	Generation     int    `json:"generation"`
	Revision       int    `json:"revision"`
	SharingAllowed bool   `json:"sharingAllowed"`
	ServerTime     string `json:"serverTime"`
}
type remoteService struct {
	ServiceID     string `json:"serviceId"`
	ObservationID string `json:"observationId"`
	PID           int    `json:"pid"`
	StartedAt     string `json:"startedAt"`
	ObservedAt    string `json:"observedAt"`
	Runtime       string `json:"runtime"`
	Project       string `json:"project"`
	Ports         []int  `json:"ports"`
	CanStop       bool   `json:"canStop"`
	ChildCount    int    `json:"childCount"`
}
type remoteCommand struct {
	ID              string        `json:"id"`
	AgentID         string        `json:"agentId"`
	RequesterID     string        `json:"requesterId"`
	RequestID       string        `json:"requestId"`
	Generation      int           `json:"generation"`
	Revision        int           `json:"revision"`
	Target          remoteService `json:"target"`
	Mode            string        `json:"mode"`
	IncludeChildren bool          `json:"includeChildren"`
	State           string        `json:"state"`
	Outcome         string        `json:"outcome"`
	RequestedAt     string        `json:"requestedAt"`
	ExpiresAt       string        `json:"expiresAt"`
	AcceptedAt      string        `json:"acceptedAt"`
	StartedAt       string        `json:"startedAt"`
	CompletedAt     string        `json:"completedAt"`
	LeaseToken      string        `json:"leaseToken"`
}
type remoteReceipt struct {
	CommandID  string `json:"commandId"`
	LeaseToken string `json:"leaseToken"`
	Outcome    string `json:"outcome"`
}
type receiptFile struct {
	AgentID    string          `json:"agentId"`
	Generation int             `json:"generation"`
	Receipts   []remoteReceipt `json:"receipts"`
}

func (r *Runner) RemotePreferences(sharing, control, accepted bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if control && !sharing {
		return errors.New("enable sharing before remote control")
	}
	if (sharing || control) && !accepted {
		return errors.New("accept developer-sharing-v1 before remote access")
	}
	next := r.Config
	next.RemotePausePending = next.RemotePausePending || (next.ShareServices && !sharing) || (next.RemoteControlAllowed && !control)
	next.ShareServices = sharing
	next.RemoteControlAllowed = control
	if err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), next); err != nil {
		return err
	}
	r.Config = next
	return nil
}
func (r *Runner) RemoteStatus() DeveloperPreferences {
	r.mu.Lock()
	defer r.mu.Unlock()
	return DeveloperPreferences{r.Config.ShareServices, r.Config.RemoteControlAllowed, r.developer.Supported()}
}
func (r *Runner) remoteLoop(ctx context.Context) {
	for {
		r.RemoteCycle(ctx)
		timer := time.NewTimer(3 * time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}
func (r *Runner) receiptPath() string { return filepath.Join(r.Dir, "remote-receipts.json") }
func (r *Runner) receipts() (receiptFile, error) {
	value := receiptFile{r.binding.AgentID, r.binding.Generation, []remoteReceipt{}}
	err := core.ReadPrivate(r.receiptPath(), 32768, &value)
	if err != nil && !os.IsNotExist(err) {
		return value, err
	}
	if value.AgentID != r.binding.AgentID || value.Generation != r.binding.Generation {
		value = receiptFile{r.binding.AgentID, r.binding.Generation, []remoteReceipt{}}
		if err := core.WritePrivate(r.receiptPath(), value); err != nil {
			return value, err
		}
	}
	if len(value.Receipts) > 32 {
		return value, errors.New("receipt bound exceeded")
	}
	return value, nil
}
func (r *Runner) flushReceipts(ctx context.Context, value *receiptFile) error {
	for len(value.Receipts) > 0 {
		receipt := value.Receipts[0]
		var result struct {
			Recorded bool `json:"recorded"`
		}
		err := r.Client.Request(ctx, "POST", "/agents/"+r.binding.AgentID+"/developer/commands/"+receipt.CommandID+"/result", r.binding.Token, struct {
			LeaseToken string `json:"leaseToken"`
			Outcome    string `json:"outcome"`
		}{receipt.LeaseToken, receipt.Outcome}, &result)
		var failure *remote.Failure
		if err != nil && !(errors.As(err, &failure) && failure.Status == 404) {
			return err
		}
		if err == nil && !result.Recorded {
			return errors.New("unacknowledged receipt")
		}
		value.Receipts = value.Receipts[1:]
		if err := core.WritePrivate(r.receiptPath(), value); err != nil {
			return err
		}
	}
	return nil
}
func (r *Runner) RemoteCycle(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.binding.Token == "" {
		return nil
	}
	receipts, err := r.receipts()
	if err != nil {
		return err
	}
	if len(receipts.Receipts) > 0 {
		if err := r.flushReceipts(ctx, &receipts); err != nil {
			var failure *remote.Failure
			if errors.As(err, &failure) && (failure.Status == 401 || failure.Status == 403) {
				r.failed(err)
			}
			return err
		}
	}
	if r.Config.RemotePausePending {
		var result struct {
			Cleared bool `json:"cleared"`
		}
		if err := r.Client.Request(ctx, "POST", "/agents/"+r.binding.AgentID+"/developer/pause", r.binding.Token, struct{}{}, &result); err != nil {
			return err
		}
		if !result.Cleared {
			return errors.New("unconfirmed pause")
		}
		r.Config.RemotePausePending = false
		if err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), r.Config); err != nil {
			return err
		}
	}
	if !r.Config.ShareServices || !r.Config.Requested.Developer {
		return nil
	}
	var config developerConfig
	if err := r.Client.Request(ctx, "GET", "/agents/"+r.binding.AgentID+"/developer/configuration", r.binding.Token, nil, &config); err != nil {
		r.failed(err)
		return err
	}
	if config.SchemaVersion != 1 || config.Generation != r.binding.Generation {
		return errors.New("developer generation changed")
	}
	if !config.SharingAllowed {
		return nil
	}
	var poll struct {
		Command *remoteCommand `json:"command"`
	}
	if err := r.Client.Request(ctx, "POST", "/agents/"+r.binding.AgentID+"/developer/poll", r.binding.Token, struct{}{}, &poll); err != nil {
		return err
	}
	if poll.Command != nil {
		c := poll.Command
		if !core.ValidUUID(c.ID) || c.AgentID != r.binding.AgentID || c.Generation != r.binding.Generation || c.Revision != config.Revision || len(c.LeaseToken) != 43 || (c.Mode != "graceful" && c.Mode != "force") {
			return errors.New("invalid command scope")
		}
		receipt := remoteReceipt{c.ID, c.LeaseToken, "unknown"}
		receipts.Receipts = append(receipts.Receipts, receipt)
		if err := core.WritePrivate(r.receiptPath(), receipts); err != nil {
			return err
		}
		if r.Config.RemoteControlAllowed && r.developer.Supported() {
			var permit struct {
				Allowed     bool `json:"allowed"`
				RemainingMs int  `json:"remainingMs"`
			}
			start := time.Now()
			err := r.Client.Request(ctx, "POST", "/agents/"+r.binding.AgentID+"/developer/commands/"+c.ID+"/start", r.binding.Token, map[string]string{"leaseToken": c.LeaseToken}, &permit)
			remaining := time.Duration(permit.RemainingMs)*time.Millisecond - time.Since(start) - 100*time.Millisecond
			if err == nil && permit.Allowed && remaining > 0 && remaining <= 10*time.Second {
				operation, cancel := context.WithTimeout(ctx, remaining)
				action, err := r.developer.RemoteStop(operation, developer.StopInput{ActionID: c.ID, ServiceID: c.Target.ServiceID, ObservationID: c.Target.ObservationID, Mode: c.Mode, IncludeChildren: c.IncludeChildren}, time.Now().Round(0).Add(remaining))
				cancel()
				if err == nil {
					receipt.Outcome = action.Outcome
				} else {
					for _, code := range []string{"STALE_OBSERVATION", "MODULE_DISABLED", "LOCAL_CONTROL_DISABLED", "PLATFORM_UNAVAILABLE", "ACTION_CONFLICT", "HISTORY_WRITE_FAILED"} {
						if err.Error() == code {
							receipt.Outcome = code
						}
					}
				}
			}
		} else {
			receipt.Outcome = "LOCAL_CONTROL_DISABLED"
		}
		receipts.Receipts[len(receipts.Receipts)-1] = receipt
		if err := core.WritePrivate(r.receiptPath(), receipts); err != nil {
			return err
		}
		if err := r.flushReceipts(ctx, &receipts); err != nil {
			return err
		}
	}
	scan, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	services, total, err := r.developer.RemoteScan(scan, r.Config.RemoteControlAllowed)
	if err != nil {
		return err
	}
	public := []remoteService{}
	for _, s := range services {
		ports := []int{}
		seen := map[int]bool{}
		for _, e := range s.Endpoints {
			if !seen[e.Port] {
				seen[e.Port] = true
				ports = append(ports, e.Port)
			}
		}
		public = append(public, remoteService{s.ID, s.ObservationID, s.PID, s.StartedAt, s.ObservedAt, s.Runtime, s.Project.Name, ports, s.CanStop, s.ChildCount})
	}
	var accepted struct {
		Accepted int `json:"accepted"`
	}
	return r.Client.Request(ctx, "POST", "/agents/"+r.binding.AgentID+"/developer/snapshot", r.binding.Token, struct {
		SchemaVersion     int             `json:"schemaVersion"`
		Generation        int             `json:"generation"`
		Revision          int             `json:"revision"`
		LocalControlReady bool            `json:"localControlReady"`
		PlatformSupported bool            `json:"platformSupported"`
		Total             int             `json:"total"`
		Services          []remoteService `json:"services"`
	}{1, r.binding.Generation, config.Revision, r.Config.RemoteControlAllowed, r.developer.Supported(), total, public}, &accepted)
}

func (r *Runner) clearRemoteReceipts() error {
	path := r.receiptPath()
	if err := core.CheckPrivate(path, false); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return os.Remove(path)
}
