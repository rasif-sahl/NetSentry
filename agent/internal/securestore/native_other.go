//go:build (!darwin && !windows) || (darwin && !cgo)

package securestore

import "errors"

func Native(string) (Store, error) {
	return nil, errors.New("OS credential store unavailable; no plaintext fallback is enabled")
}
