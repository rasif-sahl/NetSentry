//go:build !windows

package core

import (
	"os"
	"testing"
)

func TestInstallationLock(t *testing.T) {
	dir := t.TempDir()
	os.Chmod(dir, 0700)
	if err := PrivateDir(dir); err != nil {
		t.Fatal(err)
	}
	unlock, err := Lock(dir)
	if err != nil {
		t.Fatal(err)
	}
	if release, err := Lock(dir); err == nil {
		release()
		t.Fatal("second process lock accepted")
	}
	unlock()
	unlock, err = Lock(dir)
	if err != nil {
		t.Fatal(err)
	}
	unlock()
}
