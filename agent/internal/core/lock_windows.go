//go:build windows

package core

import "errors"

func Lock(string) (func(), error) {
	return nil, errors.New("Windows private installation locking is not yet available")
}
