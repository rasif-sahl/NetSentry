package core

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func UUID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("system randomness unavailable")
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
}
func Secret() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	return hex.EncodeToString(b), err
}
func StrictJSON(data []byte, target any) error {
	if err := validateJSON(data); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return errors.New("invalid or unsupported JSON")
	}
	if decoder.Decode(new(any)) != io.EOF {
		return errors.New("multiple JSON values")
	}
	return nil
}
func ReadPrivate(path string, max int64, target any) error {
	if err := CheckPrivate(path, false); err != nil {
		return err
	}
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, max+1))
	if err != nil {
		return err
	}
	if int64(len(data)) > max {
		return errors.New("private file exceeds limit")
	}
	return StrictJSON(data, target)
}
func WritePrivate(path string, value any) error {
	if err := CheckPrivate(filepath.Dir(path), true); err != nil {
		return err
	}
	if _, err := os.Lstat(path); err == nil {
		if err := CheckPrivate(path, false); err != nil {
			return err
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".netsentry-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if err = file.Chmod(0600); err == nil {
		_, err = file.Write(data)
	}
	if err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(name, path)
}
func PrivateDir(path string) error {
	if !filepath.IsAbs(path) {
		return errors.New("state directory must be absolute")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	err := os.Mkdir(path, 0700)
	if err != nil && !os.IsExist(err) {
		return err
	}
	if err == nil {
		if err := HardenDirectory(path); err != nil {
			return err
		}
	}
	return CheckPrivate(path, true)
}
