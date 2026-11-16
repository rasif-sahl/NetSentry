package main

import (
	"context"
	"errors"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/recovery"
	"netsentry.local/agent/internal/runner"
	"netsentry.local/agent/internal/securestore"
	"os"
	"path/filepath"
	"runtime"
)

type diagnosticResult struct {
	SchemaVersion int      `json:"schemaVersion"`
	Codes         []string `json:"codes"`
}

func diagnose(dir string, repair bool) error {
	result := diagnosticResult{1, []string{}}
	add := func(code string) error { result.Codes = append(result.Codes, code); return emit(result) }
	if runtime.GOOS == "windows" {
		return add("PLATFORM_UNSUPPORTED")
	}
	if err := core.CheckPrivate(dir, true); err != nil {
		if os.IsNotExist(err) {
			return add("STATE_MISSING")
		}
		return add("STATE_UNSAFE")
	}
	resolved, err := filepath.EvalSymlinks(dir)
	if err != nil || resolved != dir {
		return add("STATE_UNSAFE")
	}
	unlock, err := core.Lock(dir)
	if err != nil {
		if errors.Is(err, core.ErrRuntimeBusy) {
			return add("RUNTIME_BUSY")
		}
		return add("LOCK_UNAVAILABLE")
	}
	defer unlock()
	if repair {
		if _, err := core.LoadConfig(dir); err != nil {
			return add("CONFIG_INVALID")
		}
	}
	socket := recovery.Socket(dir, repair)
	result.Codes = append(result.Codes, socket)
	if repair {
		return emit(result)
	}
	config, err := core.LoadConfig(dir)
	if err != nil {
		return add("CONFIG_INVALID")
	}
	if config.BackgroundAllowed {
		result.Codes = append(result.Codes, "LOCAL_BACKGROUND_ENABLED")
	} else {
		result.Codes = append(result.Codes, "LOCAL_BACKGROUND_DISABLED")
	}
	store, err := securestore.Open(dir, config)
	if err != nil {
		return add("CREDENTIALS_UNAVAILABLE")
	}
	// Check workspace eligibility without changing the user's local choice.
	config.BackgroundAllowed = true
	if _, err := runner.BackgroundConfiguration(context.Background(), config, store); err != nil {
		return add(runner.BackgroundCode(err))
	}
	return add("WORKSPACE_BACKGROUND_ALLOWED")
}
