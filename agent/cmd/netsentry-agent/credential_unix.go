//go:build !windows

package main

import (
	"errors"
	"io"
	"netsentry.local/agent/internal/securestore"
	"os"
)

func credentialPipe(store securestore.Store) error {
	pipe := os.NewFile(3, "desktop-credential")
	if pipe == nil {
		return errors.New("desktop credential requires an inherited pipe")
	}
	defer pipe.Close()
	info, err := pipe.Stat()
	if err != nil || info.Mode()&os.ModeNamedPipe == 0 && info.Mode()&os.ModeSocket == 0 {
		return errors.New("desktop credential requires an inherited pipe")
	}
	secret, err := store.Get("ipc")
	if err != nil || len(secret) != 64 {
		return errors.New("local credential unavailable")
	}
	_, err = io.WriteString(pipe, secret)
	return err
}
