//go:build !windows

package core

import (
	"errors"
	"os"
	"path/filepath"
	"syscall"
)

// Lock serializes all processes that can mutate installation state. The inode is
// deliberately retained after unlock so another opener cannot lock a new inode.
func Lock(dir string) (func(), error) {
	if err := CheckPrivate(dir, true); err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "runtime.lock")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return nil, errors.New("agent runtime lock unavailable")
	}
	if err := CheckPrivate(path, false); err != nil {
		file.Close()
		return nil, err
	}
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		file.Close()
		if errors.Is(err, syscall.EWOULDBLOCK) {
			return nil, ErrRuntimeBusy
		}
		return nil, errors.New("agent runtime lock unavailable")
	}
	return func() { syscall.Flock(int(file.Fd()), syscall.LOCK_UN); file.Close() }, nil
}
