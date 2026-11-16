package runner

import (
	"context"
	"errors"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/remote"
	"netsentry.local/agent/internal/securestore"
)

// BackgroundConfiguration checks consent and a fresh server grant without
// constructing collectors, opening queues, or uploading measurements.
func BackgroundConfiguration(ctx context.Context, config core.Config, store securestore.Store) (core.RemoteConfig, error) {
	if !config.BackgroundAllowed {
		return core.RemoteConfig{}, errors.New("local background consent is disabled")
	}
	binding, err := securestore.Binding(store)
	if err != nil || binding.Token == "" || binding.APIURL != config.APIURL {
		return core.RemoteConfig{}, errors.New("paired identity is required")
	}
	client, err := remote.New(config.APIURL, config.DevelopmentStore)
	if err != nil {
		return core.RemoteConfig{}, err
	}
	current, err := client.Configuration(ctx, binding)
	if err != nil {
		return core.RemoteConfig{}, err
	}
	if !current.BackgroundAllowed || current.Generation != binding.Generation {
		return core.RemoteConfig{}, errors.New("current workspace background authorization is required; reconcile in the foreground")
	}
	return current, nil
}
