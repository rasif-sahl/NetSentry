package developer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"
)

const ObservationTTL = 15 * time.Second
const MaxHistory = 100

type Service struct {
	ID                  string     `json:"id"`
	ObservationID       string     `json:"observationId"`
	PID                 int        `json:"pid"`
	ParentPID           int        `json:"parentPid"`
	Runtime             string     `json:"runtime"`
	Executable          string     `json:"executable"`
	StartedAt           string     `json:"startedAt"`
	UptimeSeconds       int64      `json:"uptimeSeconds"`
	ObservedAt          string     `json:"observedAt"`
	Endpoints           []Endpoint `json:"endpoints"`
	AdditionalEndpoints int        `json:"additionalEndpoints"`
	Project             Project    `json:"project"`
	ChildCount          int        `json:"childCount"`
	CanStop             bool       `json:"canStop"`
	BlockReason         string     `json:"blockReason"`
}
type Inventory struct {
	SchemaVersion       int       `json:"schemaVersion"`
	Services            []Service `json:"services"`
	Total               int       `json:"total"`
	Offset              int       `json:"offset"`
	NextOffset          int       `json:"nextOffset"`
	Truncated           bool      `json:"truncated"`
	SkippedProcesses    int       `json:"skippedProcesses"`
	ObservedAt          string    `json:"observedAt"`
	ExpiresAt           string    `json:"expiresAt"`
	PlatformSupported   bool      `json:"platformSupported"`
	LocalControlAllowed bool      `json:"localControlAllowed"`
}
type StopInput struct {
	ActionID        string `json:"actionId"`
	ServiceID       string `json:"serviceId"`
	ObservationID   string `json:"observationId"`
	Mode            string `json:"mode"`
	IncludeChildren bool   `json:"includeChildren"`
}
type Action struct {
	ActionID        string `json:"actionId"`
	ServiceID       string `json:"serviceId"`
	Mode            string `json:"mode"`
	IncludeChildren bool   `json:"includeChildren"`
	PID             int    `json:"pid"`
	Project         string `json:"project"`
	RequestedAt     string `json:"requestedAt"`
	CompletedAt     string `json:"completedAt"`
	Outcome         string `json:"outcome"`
	TargetCount     int    `json:"targetCount"`
	Fingerprint     string `json:"-"`
}
type savedAction struct {
	Action      Action `json:"action"`
	Fingerprint string `json:"fingerprint"`
}
type state struct {
	SchemaVersion int               `json:"schemaVersion"`
	Labels        map[string]string `json:"labels"`
	History       []savedAction     `json:"history"`
}
type captured struct {
	service   Service
	process   Process
	endpoints []Endpoint
	children  []Process
	key       string
	at        time.Time
}
type Manager struct {
	mu           sync.Mutex
	adapter      Adapter
	path         string
	value        state
	observations map[string]captured
	now          func() time.Time
}

func New(dir string, adapter Adapter) (*Manager, error) {
	m := &Manager{adapter: adapter, path: filepath.Join(dir, "developer.json"), value: state{1, map[string]string{}, []savedAction{}}, observations: map[string]captured{}, now: time.Now}
	if err := core.ReadPrivate(m.path, 262144, &m.value); err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	if m.value.SchemaVersion != 1 || len(m.value.Labels) > 128 || len(m.value.History) > MaxHistory || m.value.Labels == nil {
		return nil, errors.New("invalid local developer state")
	}
	for key, label := range m.value.Labels {
		if len(key) != 64 || len([]rune(label)) > 100 || display(label) != label {
			return nil, errors.New("invalid project association")
		}
	}
	changed := false
	for i := range m.value.History {
		a := &m.value.History[i]
		if !core.ValidUUID(a.Action.ActionID) || len(a.Fingerprint) != 64 {
			return nil, errors.New("invalid action journal")
		}
		if a.Action.Outcome == "pending" {
			a.Action.Outcome = "unknown"
			changed = true
		}
	}
	before := len(m.value.History)
	m.prune()
	if changed || before != len(m.value.History) {
		if err := m.save(); err != nil {
			return nil, err
		}
	}
	return m, nil
}
func (m *Manager) Supported() bool { return m.adapter.Supported() }
func descendants(all []Process, pid int) []Process {
	result := []Process{}
	seen := map[int]bool{pid: true}
	for pass := 0; pass < 32; pass++ {
		added := false
		for _, p := range all {
			if !seen[p.PID] && seen[p.ParentPID] {
				seen[p.PID] = true
				result = append(result, p)
				added = true
			}
		}
		if !added {
			break
		}
	}
	return result
}
func protected(all []Process, pid int) bool {
	if pid <= 1 || pid == os.Getpid() {
		return true
	}
	current := os.Getpid()
	for depth := 0; depth < 64; depth++ {
		found := false
		for _, p := range all {
			if p.PID == current {
				current = p.ParentPID
				found = true
				break
			}
		}
		if current == pid {
			return true
		}
		if !found || current <= 1 {
			break
		}
	}
	return false
}
func (m *Manager) Scan(ctx context.Context, query string, offset int, control bool) (Inventory, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	out := Inventory{SchemaVersion: 1, Services: []Service{}, ObservedAt: core.Timestamp(now), ExpiresAt: core.Timestamp(now.Add(ObservationTTL)), PlatformSupported: m.adapter.Supported(), LocalControlAllowed: control, NextOffset: -1}
	if !m.adapter.Supported() {
		return out, nil
	}
	if len([]rune(query)) > 100 || offset < 0 || offset > 256 {
		return out, errors.New("invalid inventory filter")
	}
	all, err := m.adapter.Processes(ctx)
	if err != nil {
		return out, err
	}
	sort.Slice(all, func(i, j int) bool { return all[i].PID < all[j].PID })
	fresh := map[string]captured{}
	matches := []Service{}
	for _, p := range all {
		if ctx.Err() != nil {
			return out, ctx.Err()
		}
		endpoints, err := m.adapter.Listeners(ctx, p)
		if err != nil {
			out.SkippedProcesses++
			continue
		}
		if len(endpoints) == 0 {
			continue
		}
		if len(fresh) >= 256 {
			out.Truncated = true
			break
		}
		encoded, _ := json.Marshal(endpoints)
		id := identifier(fmt.Sprintf("%d/%d/%s/%s", p.PID, p.Version, p.Started.UTC().Format(time.RFC3339Nano), encoded))
		project, key := inferProject(p.Directory)
		if key == "unknown" {
			key = fmt.Sprintf("unknown/%d/%d", p.PID, p.Version)
		}
		hashedKey := identifier(key)
		if label, ok := m.value.Labels[hashedKey]; ok {
			project = Project{identifier("manual/" + label), label, "manual", "user_confirmed", "Local project label chosen by you"}
		}
		children := descendants(all, p.PID)
		runtime := runtimeName(p.Executable)
		block := ""
		if p.UID != os.Getuid() || p.Privileged || p.Version == 0 || protected(all, p.PID) {
			block = "PROTECTED_PROCESS"
		} else if runtime == "unknown" {
			block = "UNSUPPORTED_RUNTIME"
		} else if !control {
			block = "LOCAL_CONTROL_DISABLED"
		}
		visible := endpoints
		if len(visible) > 8 {
			visible = visible[:8]
		}
		service := Service{ID: id, ObservationID: core.UUID(), PID: p.PID, ParentPID: p.ParentPID, Runtime: runtime, Executable: display(filepath.Base(p.Executable)), StartedAt: core.Timestamp(p.Started), UptimeSeconds: max(0, int64(now.Sub(p.Started).Seconds())), ObservedAt: core.Timestamp(now), Endpoints: visible, AdditionalEndpoints: len(endpoints) - len(visible), Project: project, ChildCount: len(children), CanStop: block == "", BlockReason: block}
		fresh[id] = captured{service, p, endpoints, children, hashedKey, now}
		text := strings.ToLower(fmt.Sprintf("%s %s %s %d %v", project.Name, service.Executable, runtime, p.PID, endpoints))
		if strings.Contains(text, strings.ToLower(query)) {
			matches = append(matches, service)
		}
	}
	m.observations = fresh
	out.Total = len(matches)
	out.Offset = offset
	if offset < len(matches) {
		end := min(offset+10, len(matches))
		out.Services = matches[offset:end]
		if end < len(matches) {
			out.NextOffset = end
		}
	}
	return out, nil
}
func (m *Manager) Project(serviceID, observationID, label string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	old, ok := m.observations[serviceID]
	if !ok || old.service.ObservationID != observationID || !m.fresh(old) {
		return errors.New("STALE_OBSERVATION")
	}
	if len([]rune(label)) > 100 || display(label) != label && label != "" {
		return errors.New("INVALID_REQUEST")
	}
	if label == "" {
		delete(m.value.Labels, old.key)
	} else {
		if _, ok := m.value.Labels[old.key]; !ok && len(m.value.Labels) >= 128 {
			return errors.New("ASSOCIATION_LIMIT")
		}
		m.value.Labels[old.key] = label
	}
	if err := m.save(); err != nil {
		return err
	}
	m.observations = map[string]captured{}
	return nil
}
func (m *Manager) fresh(c captured) bool {
	age := m.now().Sub(c.at)
	return age >= 0 && age <= ObservationTTL
}
func (m *Manager) prune() {
	cutoff := m.now().Add(-7 * 24 * time.Hour)
	result := []savedAction{}
	for _, entry := range m.value.History {
		at, err := time.Parse(core.TimeLayout, entry.Action.RequestedAt)
		if err == nil && !at.Before(cutoff) {
			result = append(result, entry)
		}
	}
	if len(result) > MaxHistory {
		result = result[len(result)-MaxHistory:]
	}
	m.value.History = result
}
func (m *Manager) save() error { m.prune(); return core.WritePrivate(m.path, m.value) }
func (m *Manager) History() ([]Action, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.save(); err != nil {
		return nil, err
	}
	out := []Action{}
	for i := len(m.value.History) - 1; i >= 0; i-- {
		out = append(out, m.value.History[i].Action)
	}
	return out, nil
}
func (m *Manager) Stop(ctx context.Context, input StopInput) (Action, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if !core.ValidUUID(input.ActionID) || len(input.ServiceID) != 64 || !core.ValidUUID(input.ObservationID) || (input.Mode != "graceful" && input.Mode != "force") {
		return Action{}, errors.New("INVALID_REQUEST")
	}
	raw, _ := json.Marshal(input)
	fingerprint := identifier(string(raw))
	for _, previous := range m.value.History {
		if previous.Action.ActionID == input.ActionID {
			if previous.Fingerprint != fingerprint {
				return Action{}, errors.New("ACTION_CONFLICT")
			}
			return previous.Action, nil
		}
	}
	old, ok := m.observations[input.ServiceID]
	if !ok || old.service.ObservationID != input.ObservationID || !m.fresh(old) {
		return Action{}, errors.New("STALE_OBSERVATION")
	}
	if !old.service.CanStop {
		return Action{}, errors.New(old.service.BlockReason)
	}
	delete(m.observations, input.ServiceID) // Consume the observation before every attempt, including failed preflight.
	action := Action{ActionID: input.ActionID, ServiceID: input.ServiceID, Mode: input.Mode, IncludeChildren: input.IncludeChildren, PID: old.process.PID, Project: old.service.Project.Name, RequestedAt: core.Timestamp(m.now()), Outcome: "pending", TargetCount: 1}
	m.value.History = append(m.value.History, savedAction{action, fingerprint})
	if err := m.save(); err != nil {
		return Action{}, err
	}
	finish := func(outcome string) (Action, error) {
		action.Outcome = outcome
		action.CompletedAt = core.Timestamp(m.now())
		for i := range m.value.History {
			if m.value.History[i].Action.ActionID == action.ActionID {
				m.value.History[i] = savedAction{action, fingerprint}
				break
			}
		}
		if err := m.save(); err != nil {
			return action, errors.New("HISTORY_WRITE_FAILED")
		}
		return action, nil
	}
	current, err := m.adapter.Inspect(old.process.PID)
	if errors.Is(err, ErrGone) {
		return finish("already_stopped")
	}
	if err != nil {
		return finish("permission_denied")
	}
	if !same(current, old.process) {
		return finish("target_changed")
	}
	endpoints, err := m.adapter.Listeners(ctx, current)
	if err != nil {
		return finish("inspection_failed")
	}
	if !reflect.DeepEqual(endpoints, old.endpoints) {
		return finish("target_changed")
	}
	targets := []Process{old.process}
	if input.IncludeChildren {
		if len(old.children) > 16 {
			return finish("tree_limit")
		}
		all, err := m.adapter.Processes(ctx)
		if err != nil {
			return finish("inspection_failed")
		}
		children := descendants(all, old.process.PID)
		if len(children) != len(old.children) {
			return finish("tree_changed")
		}
		for _, child := range old.children {
			found := false
			for _, now := range children {
				if same(child, now) && child.ParentPID == now.ParentPID && !protected(all, now.PID) && now.UID == os.Getuid() {
					found = true
				}
			}
			if !found {
				return finish("tree_changed")
			}
		}
		for _, child := range old.children {
			targets = append([]Process{child}, targets...)
		}
	}
	action.TargetCount = len(targets)
	for i := range m.value.History {
		if m.value.History[i].Action.ActionID == action.ActionID {
			m.value.History[i].Action = action
		}
	}
	if err := m.save(); err != nil {
		return Action{}, errors.New("HISTORY_WRITE_FAILED")
	}
	for i, target := range targets {
		if ctx.Err() != nil {
			return finish("unknown")
		}
		if err := m.adapter.Signal(target, input.Mode == "force"); err != nil {
			if i > 0 {
				return finish("partial")
			}
			if errors.Is(err, ErrGone) {
				return finish("target_changed")
			}
			return finish("permission_denied")
		}
	}
	deadline := time.NewTimer(3 * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		alive := false
		unknown := false
		for _, target := range targets {
			p, err := m.adapter.Inspect(target.PID)
			if err != nil && !errors.Is(err, ErrGone) {
				unknown = true
			}
			if err == nil && same(p, target) {
				alive = true
			}
		}
		if !alive && !unknown {
			until := time.Now().Add(500 * time.Millisecond)
			for {
				all, err := m.adapter.Processes(ctx)
				if err != nil {
					return finish("stopped_unverified_listeners")
				}
				for _, p := range all {
					eps, err := m.adapter.Listeners(ctx, p)
					if err != nil {
						continue
					}
					for _, e := range eps {
						for _, before := range old.endpoints {
							if e.Address == before.Address && e.Port == before.Port {
								return finish("replacement_listener")
							}
						}
					}
				}
				if !time.Now().Before(until) {
					return finish("stopped")
				}
				select {
				case <-ctx.Done():
					return finish("stopped_unverified_listeners")
				case <-time.After(100 * time.Millisecond):
				}
			}
		}
		select {
		case <-ctx.Done():
			return finish("unknown")
		case <-deadline.C:
			if unknown {
				return finish("inspection_failed")
			}
			return finish("still_running")
		case <-ticker.C:
		}
	}
}

func (m *Manager) Reset() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.observations = map[string]captured{}
	m.value = state{1, map[string]string{}, []savedAction{}}
	if _, err := os.Lstat(m.path); os.IsNotExist(err) {
		return nil
	}
	return m.save()
}
