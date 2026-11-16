//go:build !windows

package localipc

import (
	"bytes"
	"context"
	"errors"
	"net"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/runner"
	"os"
	"path/filepath"
	"sync"
	"time"
)

func Serve(ctx context.Context, dir, secret string, agent *runner.Runner) error {
	if err := core.CheckPrivate(dir, true); err != nil {
		return err
	}
	path := filepath.Join(dir, "agent.sock")
	if len(path) > 100 {
		return errors.New("local socket path is too long")
	}
	if _, err := os.Lstat(path); err == nil {
		return errors.New("local socket already exists; do not replace a running agent")
	} else if !os.IsNotExist(err) {
		return err
	}
	listener, err := net.Listen("unix", path)
	if err != nil {
		return errors.New("could not bind private local socket")
	}
	if unix, ok := listener.(*net.UnixListener); ok {
		unix.SetUnlinkOnClose(false)
	}
	defer listener.Close()
	if err := os.Chmod(path, 0600); err != nil {
		return err
	}
	original, err := os.Lstat(path)
	if err != nil {
		return err
	}
	defer func() {
		current, err := os.Lstat(path)
		if err == nil && os.SameFile(original, current) {
			os.Remove(path)
		}
	}()
	var clients sync.WaitGroup
	defer clients.Wait()
	slots := make(chan struct{}, 16)
	done := make(chan struct{})
	defer close(done)
	go func() {
		select {
		case <-ctx.Done():
			listener.Close()
		case <-done:
		}
	}()
	for {
		conn, err := listener.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return errors.New("local socket listener failed")
		}
		select {
		case slots <- struct{}{}:
			clients.Add(1)
			go func() {
				defer clients.Done()
				defer func() { <-slots }()
				defer conn.Close()
				if Authenticate(conn, secret) != nil {
					return
				}
				conn.SetDeadline(time.Now().Add(20 * time.Second))
				var request Request
				if Read(conn, &request) != nil || (request.SchemaVersion != 2 && request.SchemaVersion != 3 && request.SchemaVersion != 4 && request.SchemaVersion != 5) || !core.ValidUUID(request.RequestID) {
					return
				}
				response := Dispatch(ctx, request, agent)
				Write(conn, response)
			}()
		default:
			conn.Close()
		}
	}
}
func Dispatch(ctx context.Context, request Request, agent *runner.Runner) Response {
	if request.SchemaVersion == 5 {
		return DispatchNetwork(request, agent)
	}
	if request.SchemaVersion == 4 {
		return DispatchRemote(request, agent)
	}
	if request.SchemaVersion == 3 {
		return DispatchDeveloper(ctx, request, agent)
	}
	response := Response{SchemaVersion: 2, RequestID: request.RequestID, Code: "OK", OK: true, Data: nil}
	invalid := func() Response { response.OK = false; response.Code = "INVALID_REQUEST"; return response }
	payload := bytes.TrimSpace(request.Payload)
	if len(payload) == 0 || payload[0] != '{' {
		return invalid()
	}
	switch request.Method {
	case "get_status":
		var payload struct{}
		if core.StrictJSON(request.Payload, &payload) != nil {
			return invalid()
		}
		response.Data = agent.Snapshot()
	case "set_modules":
		var payload struct {
			Network   *bool `json:"network"`
			Developer *bool `json:"developer"`
		}
		if core.StrictJSON(request.Payload, &payload) != nil || payload.Network == nil || payload.Developer == nil {
			return invalid()
		}
		modules := core.Modules{Network: *payload.Network, Developer: *payload.Developer}
		if agent.Settings(&modules, nil) != nil {
			response.OK = false
			response.Code = "SETTINGS_WRITE_FAILED"
		} else {
			response.Data = agent.Snapshot()
		}
	case "set_background":
		var payload struct {
			Allowed *bool `json:"allowed"`
		}
		if core.StrictJSON(request.Payload, &payload) != nil || payload.Allowed == nil {
			return invalid()
		}
		if agent.Settings(nil, payload.Allowed) != nil {
			response.OK = false
			response.Code = "SETTINGS_WRITE_FAILED"
		} else {
			response.Data = agent.Snapshot()
		}
	case "pair":
		var payload struct {
			Token string `json:"token"`
		}
		if core.StrictJSON(request.Payload, &payload) != nil || len(payload.Token) != 43 {
			return invalid()
		}
		operation, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		if agent.Pair(operation, payload.Token) != nil {
			response.OK = false
			response.Code = "PAIRING_FAILED"
		} else {
			response.Data = agent.Snapshot()
		}
	case "list_services", "request_stop":
		status := agent.Snapshot()
		response.OK = false
		if !status.Effective.Developer {
			response.Code = "MODULE_DISABLED"
		} else {
			response.Code = "UNAVAILABLE_PHASE"
		}
	default:
		return invalid()
	}
	return response
}
