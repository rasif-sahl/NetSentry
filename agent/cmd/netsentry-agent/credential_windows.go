//go:build windows

package main

import (
	"errors"
	"netsentry.local/agent/internal/securestore"
)

func credentialPipe(securestore.Store) error {
	return errors.New("Windows desktop credential transport is not available")
}
