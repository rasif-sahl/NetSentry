package runner

import (
	"context"
	"errors"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/remote"
	"netsentry.local/agent/internal/securestore"
)

// BackgroundFailure carries only a public diagnostic code, never backend details.
type BackgroundFailure struct{ Code string }

func (e *BackgroundFailure) Error() string { return e.Code }
func BackgroundCode(err error) string {
	var failure *BackgroundFailure
	if errors.As(err, &failure) {
		return failure.Code
	}
	return "BACKEND_UNAVAILABLE"
}

// BackgroundConfiguration checks consent and a fresh server grant without
// constructing collectors, opening queues, or uploading measurements.
func BackgroundConfiguration(ctx context.Context, config core.Config, store securestore.Store) (core.RemoteConfig, error) {
	if !config.BackgroundAllowed {
		return core.RemoteConfig{}, &BackgroundFailure{"LOCAL_BACKGROUND_DISABLED"}
	}
	binding, err := securestore.Binding(store)
	if err != nil && !errors.Is(err, securestore.ErrNotFound) {
		return core.RemoteConfig{}, &BackgroundFailure{"CREDENTIALS_UNAVAILABLE"}
	}
	if err != nil || binding.Token == "" || binding.APIURL != config.APIURL {
		return core.RemoteConfig{}, &BackgroundFailure{"PAIRING_REQUIRED"}
	}
	client, err := remote.New(config.APIURL, config.DevelopmentStore)
	if err != nil {
		return core.RemoteConfig{}, &BackgroundFailure{"CONFIG_INVALID"}
	}
	current, err := client.Configuration(ctx, binding)
	if err != nil {
		var failure *remote.Failure
		if errors.As(err, &failure) {
			if failure.Status == 401 || failure.Status == 403 || failure.Status == 410 {
				return core.RemoteConfig{}, &BackgroundFailure{"PAIRING_REJECTED"}
			}
			return core.RemoteConfig{}, &BackgroundFailure{"BACKEND_REJECTED"}
		}
		return core.RemoteConfig{}, &BackgroundFailure{"BACKEND_UNAVAILABLE"}
	}
	if current.Generation != binding.Generation {
		return core.RemoteConfig{}, &BackgroundFailure{"PAIRING_STALE"}
	}
	if !current.BackgroundAllowed {
		return core.RemoteConfig{}, &BackgroundFailure{"WORKSPACE_BACKGROUND_DENIED"}
	}
	return current, nil
}
