package developer

import (
	"context"
	"errors"
	"time"
)

var ErrGone = errors.New("process exited or identity changed")
var ErrDenied = errors.New("process inspection or signalling denied")
var ErrUnsupported = errors.New("developer adapter unavailable on this platform")

type Process struct {
	PID, ParentPID, UID   int
	Version               uint32
	Started               time.Time
	Executable, Directory string
	Privileged            bool
}
type Endpoint struct {
	SocketID string `json:"socketId"`
	Address  string `json:"address"`
	Port     int    `json:"port"`
}
type Observation struct {
	Process   Process
	Endpoints []Endpoint
}
type Adapter interface {
	Supported() bool
	Processes(context.Context) ([]Process, error)
	Inspect(int) (Process, error)
	Listeners(context.Context, Process) ([]Endpoint, error)
	Signal(Process, bool) error
}

func same(a, b Process) bool {
	return a.PID == b.PID && a.Version == b.Version && a.UID == b.UID && a.Started.Equal(b.Started) && a.Executable == b.Executable && !a.Privileged && !b.Privileged
}
