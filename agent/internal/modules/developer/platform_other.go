//go:build !darwin || !cgo

package developer

import "context"

type native struct{}

func Native() Adapter                                                 { return native{} }
func (native) Supported() bool                                        { return false }
func (native) Processes(context.Context) ([]Process, error)           { return nil, ErrUnsupported }
func (native) Inspect(int) (Process, error)                           { return Process{}, ErrUnsupported }
func (native) Listeners(context.Context, Process) ([]Endpoint, error) { return nil, ErrUnsupported }
func (native) Signal(Process, bool) error                             { return ErrUnsupported }
