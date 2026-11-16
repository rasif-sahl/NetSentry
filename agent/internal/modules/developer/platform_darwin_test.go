//go:build darwin && cgo

package developer

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"netsentry.local/agent/internal/core"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

func sample(t *testing.T, ignore bool) (*exec.Cmd, int) {
	t.Helper()
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatal("Node is required for controlled native acceptance", err)
	}
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"), []byte(`{}`), 0600)
	script := `const net=require('node:net');if(process.env.NS_IGNORE==='yes')process.on('SIGTERM',()=>{});const s=net.createServer();s.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:s.address().port})));`
	command := exec.Command(node, "-e", script)
	command.Dir = dir
	command.Env = append(os.Environ(), "NS_IGNORE=no")
	if ignore {
		command.Env = append(os.Environ(), "NS_IGNORE=yes")
	}
	stdout, err := command.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err = command.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { command.Process.Kill(); command.Wait() })
	line, err := bufio.NewReader(stdout).ReadBytes('\n')
	if err != nil {
		t.Fatal(err)
	}
	var value struct {
		Port int `json:"port"`
	}
	if json.Unmarshal(line, &value) != nil || value.Port == 0 {
		t.Fatal("sample did not start")
	}
	return command, value.Port
}
func TestNativeControlledServices(t *testing.T) {
	first, port := sample(t, false)
	other, otherPort := sample(t, false)
	adapter := Native()
	if !adapter.Supported() {
		t.Fatal("macOS incarnation-bound signal API unavailable")
	}
	process, err := adapter.Inspect(first.Process.Pid)
	if err != nil || process.Version == 0 {
		t.Fatal("native identity unavailable", err)
	}
	wrong := process
	wrong.Version++
	if err := adapter.Signal(wrong, false); err == nil {
		t.Fatal("wrong incarnation signalled")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	manager, err := New(dir, adapter)
	if err != nil {
		t.Fatal(err)
	}
	inventory, err := manager.Scan(ctx, "", 0, true)
	if err != nil {
		t.Fatal(err)
	}
	var target Service
	for offset := 0; ; {
		for _, service := range inventory.Services {
			if service.PID == first.Process.Pid {
				target = service
			}
		}
		if target.ID != "" || inventory.NextOffset < 0 {
			break
		}
		offset = inventory.NextOffset
		inventory, err = manager.Scan(ctx, "", offset, true)
		if err != nil {
			t.Fatal(err)
		}
	}
	if target.ID == "" || !target.CanStop || target.Project.Source != "inferred" {
		t.Fatal("controlled listener not discovered", target)
	}
	found := false
	for _, endpoint := range target.Endpoints {
		if endpoint.Port == port {
			found = true
		}
	}
	if !found {
		t.Fatal("listener port missing")
	}
	input := StopInput{core.UUID(), target.ID, target.ObservationID, "graceful", false}
	action, err := manager.Stop(ctx, input)
	if err != nil || action.Outcome != "stopped" {
		t.Fatal("graceful stop did not verify", action, err)
	}
	again, err := manager.Stop(ctx, input)
	if err != nil || again.ActionID != action.ActionID || again.Outcome != action.Outcome {
		t.Fatal("duplicate action changed", err)
	}
	surviving, err := adapter.Inspect(other.Process.Pid)
	if err != nil {
		t.Fatal("unrelated process affected", err)
	}
	eps, err := adapter.Listeners(ctx, surviving)
	if err != nil || len(eps) == 0 || eps[0].Port != otherPort {
		t.Fatal("unrelated listener affected", eps, err)
	}
	restarted, err := New(dir, adapter)
	if err != nil || len(history(t, restarted)) != 1 {
		t.Fatal("action history not durable", err)
	}
}
func TestNativeForceIsSeparate(t *testing.T) {
	command, _ := sample(t, true)
	adapter := Native()
	p, err := adapter.Inspect(command.Process.Pid)
	if err != nil {
		t.Fatal(err)
	}
	if err := adapter.Signal(p, false); err != nil {
		t.Fatal(err)
	}
	time.Sleep(150 * time.Millisecond)
	if _, err := adapter.Inspect(p.PID); err != nil {
		t.Fatal("fixture should ignore graceful signal")
	}
	if err := adapter.Signal(p, true); err != nil {
		t.Fatal("separate force signal failed", err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := adapter.Inspect(p.PID); err == ErrGone {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("forced fixture remained alive")
}

func TestNativeSocketReuseDoesNotRetarget(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatal(err)
	}
	script := `const net=require('node:net');let s=net.createServer();let port;s.listen(0,'127.0.0.1',()=>{port=s.address().port;console.log(port)});process.stdin.once('data',()=>s.close(()=>{s=net.createServer();s.listen(port,'127.0.0.1',()=>console.log('rebound'))}));`
	command := exec.Command(node, "-e", script)
	stdin, _ := command.StdinPipe()
	stdout, _ := command.StdoutPipe()
	if err = command.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { command.Process.Kill(); command.Wait() }()
	reader := bufio.NewReader(stdout)
	if _, err = reader.ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	manager, _ := New(dir, Native())
	inventory, err := manager.Scan(context.Background(), fmt.Sprint(command.Process.Pid), 0, true)
	if err != nil {
		t.Fatal(err)
	}
	var target Service
	for _, s := range inventory.Services {
		if s.PID == command.Process.Pid {
			target = s
		}
	}
	if target.ID == "" {
		t.Fatal("controlled listener missing")
	}
	if target.Endpoints[0].SocketID == identifier("0") {
		t.Fatal("kernel socket generation missing")
	}
	stdin.Write([]byte("rebind\n"))
	if line, err := reader.ReadString('\n'); err != nil || line != "rebound\n" {
		t.Fatal("fixture did not rebind", line, err)
	}
	action, err := manager.Stop(context.Background(), input(target))
	if err != nil || action.Outcome != "target_changed" {
		t.Fatal("socket reuse was retargeted", action, err)
	}
	if _, err = Native().Inspect(command.Process.Pid); err != nil {
		t.Fatal("rebound process was affected", err)
	}
}
func TestNativePythonService(t *testing.T) {
	python, err := exec.LookPath("python3")
	if err != nil {
		t.Skip("Python runtime unavailable; no installation is attempted")
	}
	project := t.TempDir()
	os.WriteFile(filepath.Join(project, "pyproject.toml"), []byte("[project]\nname='fixture'\n"), 0600)
	command := exec.Command(python, "-u", "-c", `import socketserver,json
server=socketserver.TCPServer(('127.0.0.1',0),socketserver.BaseRequestHandler)
print(json.dumps({'port':server.server_address[1]}),flush=True)
server.serve_forever()`)
	command.Dir = project
	stdout, _ := command.StdoutPipe()
	if err = command.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { command.Process.Kill(); command.Wait() }()
	if _, err = bufio.NewReader(stdout).ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	manager, _ := New(dir, Native())
	inventory, err := manager.Scan(context.Background(), fmt.Sprint(command.Process.Pid), 0, true)
	if err != nil {
		t.Fatal(err)
	}
	var target Service
	for _, s := range inventory.Services {
		if s.PID == command.Process.Pid {
			target = s
		}
	}
	if target.Runtime != "Python" || !target.CanStop {
		t.Fatal("Python service missing or unavailable", target)
	}
	action, err := manager.Stop(context.Background(), input(target))
	if err != nil || action.Outcome != "stopped" {
		t.Fatal("Python graceful stop failed", action, err)
	}
}

func TestNativeSupervisorReplacementIsReported(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatal(err)
	}
	script := `const {spawn}=require('node:child_process');let child,port=0,closing=false;function start(){child=spawn(process.execPath,['-e',"const s=require('node:net').createServer();s.listen("+port+",'127.0.0.1',()=>console.log(s.address().port));"]);child.stdout.once('data',data=>{port=Number(String(data).trim());console.log(JSON.stringify({pid:child.pid,port}))});child.once('exit',()=>{if(closing)process.exit(0);else start()})}process.on('SIGTERM',()=>{closing=true;child.kill('SIGTERM')});start();`
	command := exec.Command(node, "-e", script)
	stdout, _ := command.StdoutPipe()
	if err = command.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { command.Process.Signal(syscall.SIGTERM); command.Wait() }()
	reader := bufio.NewReader(stdout)
	line, err := reader.ReadBytes('\n')
	if err != nil {
		t.Fatal(err)
	}
	var first struct {
		PID  int `json:"pid"`
		Port int `json:"port"`
	}
	if json.Unmarshal(line, &first) != nil {
		t.Fatal("bad supervisor fixture")
	}
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	manager, _ := New(dir, Native())
	inventory, err := manager.Scan(context.Background(), fmt.Sprint(first.PID), 0, true)
	if err != nil {
		t.Fatal(err)
	}
	var target Service
	for _, s := range inventory.Services {
		if s.PID == first.PID {
			target = s
		}
	}
	if target.ID == "" {
		t.Fatal("supervised listener missing")
	}
	action, err := manager.Stop(context.Background(), input(target))
	if err != nil || action.Outcome != "replacement_listener" {
		t.Fatal("supervisor replacement was not reported", action, err)
	}
	line, err = reader.ReadBytes('\n')
	if err != nil {
		t.Fatal(err)
	}
	var second struct {
		PID  int `json:"pid"`
		Port int `json:"port"`
	}
	json.Unmarshal(line, &second)
	if second.PID == first.PID || second.Port != first.Port {
		t.Fatal("supervisor fixture did not replace listener")
	}
	if _, err = Native().Inspect(second.PID); err != nil {
		t.Fatal("replacement was affected", err)
	}
}
