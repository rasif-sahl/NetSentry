//go:build windows

package localipc

import (
	"context"
	"errors"
	"netsentry.local/agent/internal/runner"
)

func Serve(context.Context, string, string, *runner.Runner) error {
	return errors.New("Windows named-pipe transport and ACL acceptance are pending; no TCP fallback is enabled")
}
