//go:build !windows

package recovery

import (
	"net"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

func privateState(t *testing.T) string {
	t.Helper()
	temporary, err := os.MkdirTemp("", "nsrec-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(temporary) })
	root, err := filepath.EvalSymlinks(temporary)
	if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(root, "agent")
	if err := core.PrivateDir(dir); err != nil {
		t.Fatal(err)
	}
	unlock, err := core.Lock(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(unlock)
	return dir
}
func socket(t *testing.T, dir string) *net.UnixListener {
	t.Helper()
	l, err := net.ListenUnix("unix", &net.UnixAddr{Name: filepath.Join(dir, "agent.sock"), Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	l.SetUnlinkOnClose(false)
	if err := os.Chmod(filepath.Join(dir, "agent.sock"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { l.Close() })
	return l
}
func TestSocketRecoveryOnlyRemovesAnOwnedDeadSocket(t *testing.T) {
	dir := privateState(t)
	if code := Socket(dir, true); code != "SOCKET_ABSENT" {
		t.Fatal(code)
	}
	l := socket(t, dir)
	if code := Socket(dir, true); code != "SOCKET_LIVE" {
		t.Fatal(code)
	}
	l.Close()
	if code := Socket(dir, false); code != "SOCKET_STALE" {
		t.Fatal(code)
	}
	if _, err := os.Lstat(filepath.Join(dir, "agent.sock")); err != nil {
		t.Fatal("inspection removed socket", err)
	}
	if code := Socket(dir, true); code != "SOCKET_REPAIRED" {
		t.Fatal(code)
	}
	if code := Socket(dir, true); code != "SOCKET_ABSENT" {
		t.Fatal(code)
	}
	if _, err := core.Lock(dir); err != core.ErrRuntimeBusy {
		t.Fatal("recovery lost the runtime lock", err)
	}
}
func TestSocketRecoveryRefusesFilesLinksAndUnsafePermissions(t *testing.T) {
	for _, kind := range []string{"file", "link", "socket-mode", "directory-mode", "directory-link"} {
		t.Run(kind, func(t *testing.T) {
			dir := privateState(t)
			path := filepath.Join(dir, "agent.sock")
			switch kind {
			case "file":
				os.WriteFile(path, []byte("not a socket"), 0600)
			case "link":
				target := filepath.Join(dir, "credentials")
				os.WriteFile(target, []byte("preserve"), 0600)
				os.Symlink(target, path)
			case "socket-mode":
				l := socket(t, dir)
				l.Close()
				os.Chmod(path, 0666)
			case "directory-mode":
				l := socket(t, dir)
				l.Close()
				os.Chmod(dir, 0755)
			case "directory-link":
				l := socket(t, dir)
				l.Close()
				link := dir + "-link"
				os.Symlink(dir, link)
				if code := Socket(link, true); code != "STATE_UNSAFE" {
					t.Fatal(code)
				}
				return
			}
			code := Socket(dir, true)
			if code != "SOCKET_UNSAFE" && code != "STATE_UNSAFE" {
				t.Fatal(code)
			}
			if _, err := os.Lstat(path); err != nil {
				t.Fatal("unsafe path removed", err)
			}
		})
	}
}

func TestRecoveryRefusesSocketReplacedDuringProbe(t *testing.T) {
	dir := privateState(t)
	original := socket(t, dir)
	original.Close()
	path := filepath.Join(dir, "agent.sock")
	var replacement *net.UnixListener
	code := socketWithDial(dir, true, func(string, string, time.Duration) (net.Conn, error) {
		// Keep the old inode linked elsewhere so the replacement cannot reuse it.
		if err := os.Rename(path, path+".old"); err != nil {
			t.Fatal(err)
		}
		replacement = socket(t, dir)
		replacement.Close()
		return nil, syscall.ECONNREFUSED
	})
	if code != "SOCKET_CHANGED" {
		t.Fatal(code)
	}
	if _, err := os.Lstat(path); err != nil {
		t.Fatal("replacement removed", err)
	}
}

func TestUncertainSocketProbeNeverRemovesTheSocket(t *testing.T) {
	for _, probeError := range []error{os.ErrPermission, os.ErrDeadlineExceeded, syscall.ENOENT} {
		dir := privateState(t)
		l := socket(t, dir)
		l.Close()
		code := socketWithDial(dir, true, func(string, string, time.Duration) (net.Conn, error) { return nil, probeError })
		if code != "SOCKET_UNKNOWN" {
			t.Fatal(code)
		}
		if _, err := os.Lstat(filepath.Join(dir, "agent.sock")); err != nil {
			t.Fatal("uncertain socket removed", err)
		}
	}
}
