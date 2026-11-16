// Package packageverify verifies detached, pinned-key release metadata and artifacts.
// It never downloads, executes, replaces or installs an executable.
package packageverify

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
	"regexp"
	"time"
)

const MaxArtifactBytes = 128 * 1024 * 1024

type Manifest struct {
	SchemaVersion int    `json:"schemaVersion"`
	Release       uint64 `json:"release"`
	Version       string `json:"version"`
	Platform      string `json:"platform"`
	Architecture  string `json:"architecture"`
	Artifact      string `json:"artifact"`
	Bytes         int64  `json:"bytes"`
	SHA256        string `json:"sha256"`
	ExpiresAt     string `json:"expiresAt"`
}

var version = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)
var hash = regexp.MustCompile(`^[a-f0-9]{64}$`)

func Verify(raw, signature, key []byte, artifact, platform, architecture string, minimumRelease uint64, now time.Time) (Manifest, error) {
	var manifest Manifest
	if len(raw) > 16384 || len(key) != ed25519.PublicKeySize || len(signature) != ed25519.SignatureSize || !ed25519.Verify(key, raw, signature) {
		return manifest, errors.New("release signature rejected")
	}
	if err := core.StrictJSON(raw, &manifest); err != nil {
		return manifest, errors.New("invalid release manifest")
	}
	expiry, err := time.Parse(core.TimeLayout, manifest.ExpiresAt)
	if err != nil || !expiry.After(now) || expiry.After(now.Add(30*24*time.Hour)) {
		return manifest, errors.New("release metadata expired or exceeds the freshness window")
	}
	if manifest.SchemaVersion != 1 || manifest.Release < minimumRelease || manifest.Release == 0 || !version.MatchString(manifest.Version) || manifest.Platform != platform || manifest.Architecture != architecture || !hash.MatchString(manifest.SHA256) || manifest.Bytes <= 0 || manifest.Bytes > MaxArtifactBytes || manifest.Artifact != filepath.Base(artifact) {
		return manifest, errors.New("release target, version or size rejected")
	}
	info, err := os.Lstat(artifact)
	if err != nil || !info.Mode().IsRegular() || info.Size() != manifest.Bytes {
		return manifest, errors.New("artifact type or size rejected")
	}
	file, err := os.Open(artifact)
	if err != nil {
		return manifest, errors.New("artifact unavailable")
	}
	defer file.Close()
	digest := sha256.New()
	n, err := io.Copy(digest, io.LimitReader(file, manifest.Bytes+1))
	if err != nil || n != manifest.Bytes || hex.EncodeToString(digest.Sum(nil)) != manifest.SHA256 {
		return manifest, errors.New("artifact digest rejected")
	}
	return manifest, nil
}
