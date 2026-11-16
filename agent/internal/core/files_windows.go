//go:build windows

package core

import "errors"

// Windows state access fails closed until native ACL runtime acceptance is completed.
func HardenDirectory(string) error {
	return errors.New("Windows private-state ACL setup is not yet available")
}
func CheckPrivate(string, bool) error {
	return errors.New("Windows private-state ACL verification is not yet available")
}
