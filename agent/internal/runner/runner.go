package runner

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"netsentry.local/agent/internal/buffer"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/modules/developer"
	"netsentry.local/agent/internal/remote"
	"netsentry.local/agent/internal/securestore"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

type Status struct {
	InstallationID          string       `json:"installationId"`
	BackgroundRequested     bool         `json:"backgroundRequested"`
	SchemaVersion           int          `json:"schemaVersion"`
	Version                 string       `json:"version"`
	Platform                string       `json:"platform"`
	Paired                  bool         `json:"paired"`
	Connection              string       `json:"connection"`
	Requested               core.Modules `json:"requested"`
	Authorized              core.Modules `json:"authorized"`
	Effective               core.Modules `json:"effective"`
	BackgroundAllowed       bool         `json:"backgroundAllowed"`
	BufferedEvents          int          `json:"bufferedEvents"`
	DroppedEvents           int          `json:"droppedEvents"`
	LastContact             string       `json:"lastContact"`
	Code                    string       `json:"code"`
	ServiceControlAvailable bool         `json:"serviceControlAvailable"`
}
type Runner struct {
	mu          sync.Mutex
	Dir         string
	Config      core.Config
	Store       securestore.Store
	Client      *remote.Client
	Queue       *buffer.Queue
	binding     core.Binding
	developer   *developer.Manager
	remote      core.RemoteConfig
	connection  string
	code        string
	lastContact string
}

func New(dir string, config core.Config, store securestore.Store) (*Runner, error) {
	client, err := remote.New(config.APIURL, config.DevelopmentStore)
	if err != nil {
		return nil, err
	}
	queue, err := buffer.Open(dir)
	if err != nil {
		return nil, err
	}
	services, err := developer.New(dir, developer.Native())
	if err != nil {
		return nil, err
	}
	r := &Runner{developer: services, Dir: dir, Config: config, Store: store, Client: client, Queue: queue, connection: "unpaired"}
	binding, err := securestore.Binding(store)
	if errors.Is(err, securestore.ErrNotFound) {
		if err := r.developer.Reset(); err != nil {
			return nil, err
		}
		return r, nil
	}
	if err != nil {
		return nil, err
	}
	if binding.APIURL != config.APIURL {
		return nil, errors.New("stored identity is bound to a different API origin")
	}
	r.binding = binding
	r.connection = "offline"
	if err := queue.Bind(binding.AgentID, binding.Generation); err != nil {
		return nil, err
	}
	return r, nil
}
func (r *Runner) Pair(ctx context.Context, token string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.binding.Token != "" {
		return errors.New("unpair before replacing an active identity")
	}
	var result struct {
		Agent         json.RawMessage   `json:"agent"`
		Token         string            `json:"agentToken"`
		Configuration core.RemoteConfig `json:"configuration"`
	}
	err := r.Client.Request(ctx, "POST", "/agents/enrol", "", struct {
		Token          string `json:"token"`
		InstallationID string `json:"installationId"`
		Platform       string `json:"platform"`
	}{token, r.Config.InstallationID, runtime.GOOS}, &result)
	if err != nil {
		return err
	}
	if len(result.Token) != 43 || result.Configuration.AgentID == "" || result.Configuration.WorkspaceID == "" {
		return errors.New("invalid pairing response")
	}
	binding := core.Binding{AgentID: result.Configuration.AgentID, WorkspaceID: result.Configuration.WorkspaceID, Generation: result.Configuration.Generation, Token: result.Token, APIURL: r.Config.APIURL}
	if err := remote.Validate(result.Configuration, binding); err != nil {
		return err
	}
	if err := r.developer.Reset(); err != nil {
		return err
	}
	r.Config.LocalControlAllowed = false
	if err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), r.Config); err != nil {
		return err
	}
	if err := r.Queue.Bind(binding.AgentID, binding.Generation); err != nil {
		return err
	}
	if err := securestore.SaveBinding(r.Store, binding); err != nil {
		return errors.New("pairing accepted but credential storage failed; revoke the agent in your workspace")
	}
	r.binding = binding
	r.remote = result.Configuration
	r.connection = "offline"
	return nil
}
func (r *Runner) Snapshot() Status {
	r.mu.Lock()
	defer r.mu.Unlock()
	queued, dropped := r.Queue.Stats()
	effective := core.Modules{Network: r.Config.Requested.Network && r.remote.Modules.Network, Developer: r.Config.Requested.Developer && r.remote.Modules.Developer}
	if r.connection != "online" {
		effective = core.Modules{}
	}
	return Status{InstallationID: r.Config.InstallationID, BackgroundRequested: r.Config.BackgroundAllowed, SchemaVersion: 1, Version: core.Version, Platform: runtime.GOOS, Paired: r.binding.Token != "", Connection: r.connection, Requested: r.Config.Requested, Authorized: r.remote.Modules, Effective: effective, BackgroundAllowed: r.Config.BackgroundAllowed && r.remote.BackgroundAllowed, BufferedEvents: queued, DroppedEvents: dropped, LastContact: r.lastContact, Code: r.code, ServiceControlAvailable: false}
}
func (r *Runner) Settings(modules *core.Modules, background *bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	next := r.Config
	if modules != nil {
		next.Requested = *modules
	}
	if background != nil {
		next.BackgroundAllowed = *background
	}
	if err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), next); err != nil {
		return err
	}
	r.Config = next
	return nil
}
func (r *Runner) Unpair() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := r.developer.Reset(); err != nil {
		return err
	}
	if err := r.Queue.Clear(); err != nil {
		return err
	}
	if err := r.Store.Delete("backend"); err != nil {
		return err
	}
	r.Config.LocalControlAllowed = false
	if err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), r.Config); err != nil {
		return err
	}
	r.binding = core.Binding{}
	r.remote = core.RemoteConfig{}
	r.connection = "unpaired"
	return nil
}
func (r *Runner) Cycle(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.binding.Token == "" {
		return nil
	}
	config, err := r.Client.Configuration(ctx, r.binding)
	if err != nil {
		return r.failed(err)
	}
	if config.Generation != r.binding.Generation {
		if err := r.Queue.Bind(r.binding.AgentID, config.Generation); err != nil {
			return err
		}
		r.binding.Generation = config.Generation
		if err := securestore.SaveBinding(r.Store, r.binding); err != nil {
			return err
		}
	}
	if err := r.Queue.Bind(r.binding.AgentID, r.binding.Generation); err != nil {
		return err
	}
	r.remote = config
	_, dropped := r.Queue.Stats()
	input := struct {
		SchemaVersion     int          `json:"schemaVersion"`
		Generation        int          `json:"generation"`
		Version           string       `json:"version"`
		Architecture      string       `json:"architecture"`
		ReportedAt        string       `json:"reportedAt"`
		Requested         core.Modules `json:"requested"`
		BackgroundAllowed bool         `json:"backgroundAllowed"`
		DroppedEvents     int          `json:"droppedEvents"`
	}{1, r.binding.Generation, core.Version, runtime.GOARCH, core.Timestamp(time.Now()), r.Config.Requested, r.Config.BackgroundAllowed, dropped}
	var latest core.RemoteConfig
	if err := r.Client.Request(ctx, "POST", "/agents/"+r.binding.AgentID+"/heartbeat", r.binding.Token, input, &latest); err != nil {
		return r.failed(err)
	}
	if err := remote.Validate(latest, r.binding); err != nil {
		return r.failed(err)
	}
	if latest.Generation != r.binding.Generation {
		return r.failed(&remote.Failure{Status: 409})
	}
	r.remote = latest
	wasOffline := r.connection != "online"
	r.connection = "online"
	r.code = ""
	r.lastContact = core.Timestamp(time.Now())
	if wasOffline {
		if err := r.Queue.Add("CONNECTION_RESTORED", time.Now()); err != nil {
			return err
		}
	}
	events, err := r.Queue.Batch(time.Now())
	if err != nil {
		return err
	}
	if len(events) > 0 {
		if err := r.Client.Sync(ctx, r.binding, events); err != nil {
			return r.failed(err)
		}
		ids := make([]string, len(events))
		for i, event := range events {
			ids[i] = event.EventID
		}
		if err := r.Queue.Ack(ids); err != nil {
			return err
		}
	}
	return nil
}
func (r *Runner) failed(err error) error {
	var failure *remote.Failure
	if errors.As(err, &failure) {
		if failure.Status == 401 || failure.Status == 403 {
			r.connection = "revoked"
			r.code = "CREDENTIAL_REVOKED"
			r.remote = core.RemoteConfig{}
			r.Config.LocalControlAllowed = false
			if clear := core.WritePrivate(filepath.Join(r.Dir, "config.json"), r.Config); clear != nil {
				return clear
			}
			if clear := r.developer.Reset(); clear != nil {
				return clear
			}
			if clear := r.Queue.Clear(); clear != nil {
				return clear
			}
			if clear := r.Store.Delete("backend"); clear != nil {
				return clear
			}
			r.binding = core.Binding{}
			return err
		}
		if failure.Status == 400 || failure.Status == 409 {
			if clear := r.Queue.Clear(); clear != nil {
				return clear
			}
			r.code = "CONFIGURATION_REQUIRED"
			r.connection = "offline"
			return err
		}
	}
	if r.code != "CONNECTION_UNAVAILABLE" {
		if add := r.Queue.Add("CONNECTION_LOST", time.Now()); add != nil {
			return add
		}
	}
	r.connection = "offline"
	r.code = "CONNECTION_UNAVAILABLE"
	return err
}
func Delay(attempt int) time.Duration {
	if attempt >= 8 {
		return 300 * time.Second
	}
	base := time.Second * time.Duration(1<<max(0, attempt))
	if base > 300*time.Second {
		base = 300 * time.Second
	}
	jitter, _ := rand.Int(rand.Reader, big.NewInt(int64(base/4+1)))
	return base + time.Duration(jitter.Int64())
}
func (r *Runner) Run(ctx context.Context, background bool) error {
	if background && !r.Config.BackgroundAllowed {
		return errors.New("background operation is not locally enabled")
	}
	attempt := 0
	for {
		err := r.Cycle(ctx)
		delay := 30 * time.Second
		if err != nil {
			delay = Delay(attempt)
			attempt = min(attempt+1, 8)
			var failure *remote.Failure
			if errors.As(err, &failure) && failure.RetryAfter > delay {
				delay = failure.RetryAfter
			}
		} else {
			attempt = 0
		}
		status := r.Snapshot()
		if status.Connection == "revoked" {
			return errors.New("agent identity revoked")
		}
		if background && !status.BackgroundAllowed {
			return errors.New("background operation is not authorized")
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return nil
		case <-timer.C:
		}
	}
}
func ReadPairingCode(path string) (string, error) {
	if err := core.CheckPrivate(path, false); err != nil {
		return "", err
	}
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	value, err := io.ReadAll(io.LimitReader(file, 45))
	n := len(value)
	if err != nil || (n != 43 && n != 44) || (n == 44 && value[43] != '\n') {
		return "", errors.New("invalid private enrolment code file")
	}
	return string(value[:43]), nil
}

// Local control is a separate owner choice, never inferred from module capabilities.
func (r *Runner) LocalControl(allowed bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	next := r.Config
	next.LocalControlAllowed = allowed
	if err := core.WritePrivate(filepath.Join(r.Dir, "config.json"), next); err != nil {
		return err
	}
	r.Config = next
	return nil
}
func (r *Runner) developerGate(ctx context.Context, action bool) error {
	if !r.Config.Requested.Developer || r.binding.Token == "" {
		return errors.New("MODULE_DISABLED")
	}
	config, err := r.Client.Configuration(ctx, r.binding)
	if err != nil {
		r.failed(err)
		return errors.New("AUTHORIZATION_UNAVAILABLE")
	}
	if config.Generation != r.binding.Generation {
		return errors.New("CONFIGURATION_REQUIRED")
	}
	if !config.Modules.Developer {
		return errors.New("MODULE_DISABLED")
	}
	if action && !r.Config.LocalControlAllowed {
		return errors.New("LOCAL_CONTROL_DISABLED")
	}
	return nil
}
func (r *Runner) Services(ctx context.Context, query string, offset int) (developer.Inventory, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := r.developerGate(ctx, false); err != nil {
		return developer.Inventory{}, err
	}
	scan, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return r.developer.Scan(scan, query, offset, r.Config.LocalControlAllowed)
}
func (r *Runner) StopService(ctx context.Context, input developer.StopInput) (developer.Action, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := r.developerGate(ctx, true); err != nil {
		return developer.Action{}, err
	}
	if !r.developer.Supported() {
		return developer.Action{}, errors.New("PLATFORM_UNAVAILABLE")
	}
	operation, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	return r.developer.Stop(operation, input)
}
func (r *Runner) ServiceProject(ctx context.Context, id, observation, label string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := r.developerGate(ctx, false); err != nil {
		return err
	}
	return r.developer.Project(id, observation, label)
}
func (r *Runner) ServiceHistory(ctx context.Context) ([]developer.Action, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := r.developerGate(ctx, false); err != nil {
		return nil, err
	}
	return r.developer.History()
}
