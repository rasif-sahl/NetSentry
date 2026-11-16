//go:build !windows

package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPrivateConfiguration(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "state")
	config, err := Initialize(dir, "http://127.0.0.1:3000/api/v1", true)
	if err != nil {
		t.Fatal(err)
	}
	if !ValidUUID(config.InstallationID) || config.Requested.Network || config.Requested.Developer || config.BackgroundAllowed {
		t.Fatal("unsafe initialization defaults")
	}
	loaded, err := LoadConfig(dir)
	if err != nil || loaded.InstallationID != config.InstallationID {
		t.Fatal("configuration did not persist", err)
	}
	if _, err := Initialize(dir, config.APIURL, true); err == nil {
		t.Fatal("installation identity overwritten")
	}
	if err := os.Chmod(filepath.Join(dir, "config.json"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadConfig(dir); err == nil {
		t.Fatal("broad file permissions accepted")
	}
}
func TestStateRejectsSymlinks(t *testing.T) {
	root := t.TempDir()
	target := filepath.Join(root, "target")
	if err := os.Mkdir(target, 0700); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(root, "link")
	if err := os.Symlink(target, link); err != nil {
		t.Fatal(err)
	}
	if err := PrivateDir(link); err == nil {
		t.Fatal("symlink state accepted")
	}
}
func TestURLPolicy(t *testing.T) {
	for _, raw := range []string{"http://example.com/api/v1", "https://user:password@example.com/api", "https://example.com/api?token=secret", "https://example.com/api#fragment"} {
		if CheckURL(raw, false) == nil {
			t.Fatalf("unsafe URL accepted: %s", raw)
		}
	}
	if CheckURL("http://127.0.0.1:3000/api/v1", false) == nil {
		t.Fatal("HTTP enabled without explicit development flag")
	}
	if CheckURL("https://example.com/api/v1", true) == nil {
		t.Fatal("development secret allowed against non-loopback")
	}
}
func TestStrictJSON(t *testing.T) {
	for _, value := range []string{`{"enabled":true,"enabled":false}`, `{"unexpected":true}`, `{"enabled":true} {}`, strings.Repeat("[", 40) + "1" + strings.Repeat("]", 40)} {
		var out struct {
			Enabled bool `json:"enabled"`
		}
		if StrictJSON([]byte(value), &out) == nil {
			t.Fatal("ambiguous or unsupported JSON accepted")
		}
	}
}
