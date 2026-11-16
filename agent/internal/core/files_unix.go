//go:build !windows

package core

import (
	"errors"
	"os"
	"syscall"
)

func HardenDirectory(path string) error { return os.Chmod(path, 0700) }
func CheckPrivate(path string, directory bool) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 || info.IsDir() != directory || (!directory && !info.Mode().IsRegular()) {
		return errors.New("unexpected private state file type")
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok || int(stat.Uid) != os.Getuid() {
		return errors.New("private state has unexpected owner")
	}
	required := os.FileMode(0600)
	if directory {
		required = 0700
	}
	if info.Mode().Perm() != required {
		return errors.New("private state permissions must be 0700/0600")
	}
	return nil
}
