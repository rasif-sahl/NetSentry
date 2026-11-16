package developer

import (
	"context"
	"errors"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type fakeAdapter struct {
	all         map[int]Process
	endpoints   map[int][]Endpoint
	signals     []int
	denied      bool
	replacement bool
	transient   int
}

func (f *fakeAdapter) Supported() bool { return true }
func (f *fakeAdapter) Processes(context.Context) ([]Process, error) {
	out := []Process{}
	for _, p := range f.all {
		out = append(out, p)
	}
	return out, nil
}
func (f *fakeAdapter) Inspect(pid int) (Process, error) {
	if len(f.signals) > 0 && f.transient > 0 {
		f.transient--
		return Process{}, ErrDenied
	}
	if p, ok := f.all[pid]; ok {
		return p, nil
	}
	return Process{}, ErrGone
}
func (f *fakeAdapter) Listeners(_ context.Context, p Process) ([]Endpoint, error) {
	return f.endpoints[p.PID], nil
}
func (f *fakeAdapter) Signal(p Process, _ bool) error {
	if f.denied {
		return ErrDenied
	}
	current, err := f.Inspect(p.PID)
	if err != nil || !same(current, p) {
		return ErrGone
	}
	f.signals = append(f.signals, p.PID)
	delete(f.all, p.PID)
	if f.replacement {
		copy := p
		copy.PID += 10
		copy.Version++
		f.all[copy.PID] = copy
		f.endpoints[copy.PID] = f.endpoints[p.PID]
	}
	return nil
}
func fixture(t *testing.T) (*Manager, *fakeAdapter, string) {
	t.Helper()
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	project := filepath.Join(dir, "sample")
	os.Mkdir(project, 0700)
	os.WriteFile(filepath.Join(project, "package.json"), []byte(`{}`), 0600)
	p := Process{PID: 900001, ParentPID: 900000, UID: os.Getuid(), Version: 10, Started: time.Now().Add(-time.Hour), Executable: "/fixture/node", Directory: project}
	f := &fakeAdapter{all: map[int]Process{p.PID: p}, endpoints: map[int][]Endpoint{p.PID: {{Address: "127.0.0.1", Port: 34567, SocketID: identifier("socket-1")}}}}
	m, err := New(dir, f)
	if err != nil {
		t.Fatal(err)
	}
	return m, f, dir
}
func observed(t *testing.T, m *Manager, control bool) Service {
	t.Helper()
	out, err := m.Scan(context.Background(), "", 0, control)
	if err != nil || len(out.Services) != 1 {
		t.Fatal("inventory missing", out, err)
	}
	return out.Services[0]
}
func input(s Service) StopInput {
	return StopInput{core.UUID(), s.ID, s.ObservationID, "graceful", false}
}
func TestStaleIdentityAndSocketReuse(t *testing.T) {
	for _, kind := range []string{"stale", "pid_reuse", "exec", "port_reuse", "exit", "denied", "disabled"} {
		t.Run(kind, func(t *testing.T) {
			m, f, _ := fixture(t)
			s := observed(t, m, kind != "disabled")
			request := input(s)
			want := "target_changed"
			switch kind {
			case "stale":
				m.now = func() time.Time { return time.Now().Add(time.Minute) }
				want = "STALE_OBSERVATION"
			case "pid_reuse":
				p := f.all[s.PID]
				p.Version++
				f.all[s.PID] = p
			case "exec":
				p := f.all[s.PID]
				p.Executable = "/different/node"
				f.all[s.PID] = p
			case "port_reuse":
				f.endpoints[s.PID] = []Endpoint{{Address: "127.0.0.1", Port: 34567, SocketID: identifier("socket-new")}}
			case "exit":
				delete(f.all, s.PID)
				want = "already_stopped"
			case "denied":
				f.denied = true
				want = "permission_denied"
			case "disabled":
				want = "LOCAL_CONTROL_DISABLED"
			}
			action, err := m.Stop(context.Background(), request)
			if err != nil {
				if err.Error() != want {
					t.Fatal(err, want)
				}
			} else if action.Outcome != want {
				t.Fatal(action, want)
			}
			if len(f.signals) != 0 {
				t.Fatal("unsafe signal sent")
			}
		})
	}
}
func TestHistoryDeduplicationAndReplacement(t *testing.T) {
	m, f, dir := fixture(t)
	s := observed(t, m, true)
	request := input(s)
	f.replacement = true
	action, err := m.Stop(context.Background(), request)
	if err != nil || action.Outcome != "replacement_listener" {
		t.Fatal(action, err)
	}
	again, err := m.Stop(context.Background(), request)
	if err != nil || again != action || len(f.signals) != 1 {
		t.Fatal("duplicate executed")
	}
	request.Mode = "force"
	if _, err = m.Stop(context.Background(), request); err == nil || err.Error() != "ACTION_CONFLICT" {
		t.Fatal("conflicting duplicate accepted")
	}
	reloaded, err := New(dir, f)
	if err != nil || len(history(t, reloaded)) != 1 {
		t.Fatal("history lost", err)
	}
	if err = reloaded.Reset(); err != nil || len(history(t, reloaded)) != 0 {
		t.Fatal("history not erased")
	}
}
func TestProjectCorrectionsAndSearch(t *testing.T) {
	m, _, dir := fixture(t)
	s := observed(t, m, false)
	if s.Project.Source != "inferred" {
		t.Fatal(s.Project)
	}
	if err := m.Project(s.ID, s.ObservationID, "My corrected project"); err != nil {
		t.Fatal(err)
	}
	out, err := m.Scan(context.Background(), "corrected", 0, false)
	if err != nil || out.Total != 1 || out.Services[0].Project.Source != "manual" {
		t.Fatal(out, err)
	}
	copy, err := New(dir, m.adapter)
	if err != nil {
		t.Fatal(err)
	}
	out, err = copy.Scan(context.Background(), "corrected", 0, false)
	if err != nil || out.Total != 1 {
		t.Fatal("correction lost")
	}
	s = out.Services[0]
	if err = copy.Project(s.ID, s.ObservationID, ""); err != nil {
		t.Fatal(err)
	}
	if observed(t, copy, false).Project.Source != "inferred" {
		t.Fatal("clear did not restore inference")
	}
}
func TestChildPreflightAndOrder(t *testing.T) {
	for _, changed := range []bool{false, true} {
		m, f, _ := fixture(t)
		parent := f.all[900001]
		child := parent
		child.PID++
		child.ParentPID = parent.PID
		child.Version++
		f.all[child.PID] = child
		grandchild := child
		grandchild.PID++
		grandchild.ParentPID = child.PID
		grandchild.Version++
		f.all[grandchild.PID] = grandchild
		s := observed(t, m, true)
		request := input(s)
		request.IncludeChildren = true
		if changed {
			extra := child
			extra.PID += 100
			f.all[extra.PID] = extra
		}
		action, err := m.Stop(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		if changed {
			if action.Outcome != "tree_changed" || len(f.signals) > 0 {
				t.Fatal("changed tree signalled")
			}
		} else if action.Outcome != "stopped" || len(f.signals) != 3 || f.signals[0] != grandchild.PID || f.signals[2] != parent.PID {
			t.Fatal("child order wrong", action, f.signals)
		}
	}
}
func TestInterruptedJournalNeverResumes(t *testing.T) {
	m, f, dir := fixture(t)
	m.value.History = []savedAction{{Action{ActionID: core.UUID(), RequestedAt: core.Timestamp(time.Now()), Outcome: "pending"}, identifier("request")}}
	if err := m.save(); err != nil {
		t.Fatal(err)
	}
	copy, err := New(dir, f)
	if err != nil || history(t, copy)[0].Outcome != "unknown" || len(f.signals) != 0 {
		t.Fatal("pending action was resumed", err)
	}
	if _, err := copy.Stop(context.Background(), StopInput{}); !errors.Is(err, ErrGone) && err == nil {
		t.Fatal("invalid target accepted")
	}
}

func history(t *testing.T, m *Manager) []Action {
	t.Helper()
	entries, err := m.History()
	if err != nil {
		t.Fatal(err)
	}
	return entries
}

func TestTemporaryInspectionFailureDuringExit(t *testing.T) {
	m, f, _ := fixture(t)
	f.transient = 1
	s := observed(t, m, true)
	action, err := m.Stop(context.Background(), input(s))
	if err != nil || action.Outcome != "stopped" || len(f.signals) != 1 {
		t.Fatal("transient exit inspection was treated as a final result", action, err)
	}
}

func TestRetentionRemovesOldReceiptsFromDisk(t *testing.T) {
	m, f, dir := fixture(t)
	m.value.History = []savedAction{{Action{ActionID: core.UUID(), RequestedAt: core.Timestamp(time.Now()), Outcome: "stopped"}, identifier("old")}}
	if err := m.save(); err != nil {
		t.Fatal(err)
	}
	m.now = func() time.Time { return time.Now().Add(8 * 24 * time.Hour) }
	if err := m.Retain(); err != nil {
		t.Fatal(err)
	}
	reloaded, err := New(dir, f)
	if err != nil || len(history(t, reloaded)) != 0 {
		t.Fatal("expired receipt remained", err)
	}
}

func TestRemoteObservationsDoNotReplaceLocalConfirmation(t *testing.T) {
	m, f, _ := fixture(t)
	local := observed(t, m, true)
	remote, _, err := m.RemoteScan(context.Background(), true)
	if err != nil || len(remote) != 1 {
		t.Fatal(err)
	}
	action, err := m.Stop(context.Background(), input(local))
	if err != nil || action.Outcome != "stopped" {
		t.Fatal("remote scan invalidated local confirmation", action, err)
	}
	action, err = m.RemoteStop(context.Background(), input(remote[0]))
	if err != nil || action.Outcome != "already_stopped" || len(f.signals) != 1 {
		t.Fatal("remote observation retargeted a stopped process", action, err)
	}
}
