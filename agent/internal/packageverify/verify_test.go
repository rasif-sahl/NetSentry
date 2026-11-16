package packageverify

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSignedArtifacts(t *testing.T) {
	key, private, _ := ed25519.GenerateKey(rand.Reader)
	file := filepath.Join(t.TempDir(), "agent")
	contents := []byte("synthetic executable fixture")
	if err := os.WriteFile(file, contents, 0600); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(contents)
	now := time.Now()
	good := Manifest{1, 5, "0.5.0", "darwin", "arm64", "agent", int64(len(contents)), hex.EncodeToString(sum[:]), core.Timestamp(now.Add(time.Hour))}
	check := func(m Manifest, alter string, want bool) {
		t.Helper()
		raw, _ := json.Marshal(m)
		signature := ed25519.Sign(private, raw)
		if alter == "metadata" {
			raw = append(raw, ' ')
		}
		if alter == "signature" {
			signature[0] ^= 1
		}
		if alter == "key" {
			key, _, _ = ed25519.GenerateKey(rand.Reader)
		}
		_, err := Verify(raw, signature, key, file, "darwin", "arm64", 5, now)
		if (err == nil) != want {
			t.Fatalf("%s: accepted=%v expected=%v (%v)", alter, err == nil, want, err)
		}
	}
	check(good, "", true)
	check(good, "metadata", false)
	check(good, "signature", false)
	bad := good
	bad.Release = 4
	check(bad, "rollback", false)
	bad = good
	bad.ExpiresAt = core.Timestamp(now.Add(-time.Hour))
	check(bad, "expired", false)
	bad = good
	bad.ExpiresAt = core.Timestamp(now.Add(31 * 24 * time.Hour))
	check(bad, "long expiry", false)
	bad = good
	bad.Platform = "windows"
	check(bad, "wrong platform", false)
	bad = good
	bad.Architecture = "amd64"
	check(bad, "wrong architecture", false)
	bad = good
	bad.Bytes = MaxArtifactBytes + 1
	check(bad, "oversize", false)
	bad = good
	bad.SHA256 = hex.EncodeToString(make([]byte, 32))
	check(bad, "digest", false)
	check(good, "key", false)
}
