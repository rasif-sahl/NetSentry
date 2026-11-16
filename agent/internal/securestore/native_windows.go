//go:build windows

package securestore

import (
	"errors"
	"syscall"
	"unsafe"
)

var advapi = syscall.NewLazyDLL("advapi32.dll")
var credRead = advapi.NewProc("CredReadW")
var credWrite = advapi.NewProc("CredWriteW")
var credDelete = advapi.NewProc("CredDeleteW")
var credFree = advapi.NewProc("CredFree")

type credential struct {
	Flags          uint32
	Type           uint32
	TargetName     *uint16
	Comment        *uint16
	LastWritten    syscall.Filetime
	BlobSize       uint32
	Blob           *byte
	Persist        uint32
	AttributeCount uint32
	Attributes     uintptr
	Alias          *uint16
	UserName       *uint16
}
type manager struct{ installation string }

func Native(id string) (Store, error) { return manager{id}, nil }
func (m manager) name(key string) (*uint16, error) {
	return syscall.UTF16PtrFromString("NetSentry/agent/" + m.installation + "/" + key)
}
func (m manager) Get(key string) (string, error) {
	name, err := m.name(key)
	if err != nil {
		return "", err
	}
	var item *credential
	ok, _, callErr := credRead.Call(uintptr(unsafe.Pointer(name)), 1, 0, uintptr(unsafe.Pointer(&item)))
	if ok == 0 {
		if callErr == syscall.Errno(1168) {
			return "", ErrNotFound
		}
		return "", errors.New("Windows Credential Manager read failed")
	}
	defer credFree.Call(uintptr(unsafe.Pointer(item)))
	if item.BlobSize > 16384 {
		return "", errors.New("credential exceeds supported size")
	}
	return string(unsafe.Slice(item.Blob, int(item.BlobSize))), nil
}
func (m manager) Set(key, value string) error {
	name, err := m.name(key)
	if err != nil {
		return err
	}
	blob := []byte(value)
	if len(blob) == 0 || len(blob) > 16384 {
		return errors.New("invalid credential size")
	}
	item := credential{Type: 1, TargetName: name, BlobSize: uint32(len(blob)), Blob: &blob[0], Persist: 2}
	ok, _, _ := credWrite.Call(uintptr(unsafe.Pointer(&item)), 0)
	if ok == 0 {
		return errors.New("Windows Credential Manager write failed")
	}
	return nil
}
func (m manager) Delete(key string) error {
	name, err := m.name(key)
	if err != nil {
		return err
	}
	ok, _, callErr := credDelete.Call(uintptr(unsafe.Pointer(name)), 1, 0)
	if ok == 0 && callErr != syscall.Errno(1168) {
		return errors.New("Windows Credential Manager deletion failed")
	}
	return nil
}
