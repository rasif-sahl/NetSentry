//go:build !windows

package recovery

import (
	"errors"
	"net"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// Socket must be called while holding the installation runtime lock. It never
// signals a process or removes anything except the unchanged private socket.
func Socket(dir string, repair bool) string {
	return socketWithDial(dir, repair, net.DialTimeout)
}

func socketWithDial(dir string, repair bool, dial func(string, string, time.Duration) (net.Conn, error)) string {
	if core.CheckPrivate(dir, true) != nil {
		return "STATE_UNSAFE"
	}
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil || resolved != dir {
		return "STATE_UNSAFE"
	}
	path := filepath.Join(dir, "agent.sock")
	original, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return "SOCKET_ABSENT"
	}
	if err != nil {
		return "SOCKET_UNKNOWN"
	}
	st, ok := original.Sys().(*syscall.Stat_t)
	if !ok || original.Mode()&os.ModeSocket == 0 || original.Mode()&os.ModeSymlink != 0 || original.Mode().Perm() != 0600 || int(st.Uid) != os.Getuid() {
		return "SOCKET_UNSAFE"
	}
	conn, err := dial("unix", path, 300*time.Millisecond)
	if err == nil {
		conn.Close()
		return "SOCKET_LIVE"
	}
	// A timeout, missing path or permission failure is not proof of a dead peer.
	if !errors.Is(err, syscall.ECONNREFUSED) {
		return "SOCKET_UNKNOWN"
	}
	current, err := os.Lstat(path)
	if err != nil || !os.SameFile(original, current) || current.Mode() != original.Mode() {
		return "SOCKET_CHANGED"
	}
	if !repair {
		return "SOCKET_STALE"
	}
	if err := os.Remove(path); err != nil {
		return "SOCKET_UNKNOWN"
	}
	return "SOCKET_REPAIRED"
}
