package securestore

import (
	"encoding/json"
	"errors"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
)

var ErrNotFound = errors.New("credential not found")

type Store interface {
	Get(string) (string, error)
	Set(string, string) error
	Delete(string) error
}
type Development struct{ Dir string }

func (s Development) path(key string) (string, error) {
	if key != "backend" && key != "ipc" {
		return "", errors.New("unknown credential slot")
	}
	return filepath.Join(s.Dir, "development-"+key+".json"), nil
}
func (s Development) Get(key string) (string, error) {
	path, err := s.path(key)
	if err != nil {
		return "", err
	}
	var value struct {
		Value string `json:"value"`
	}
	err = core.ReadPrivate(path, 16384, &value)
	if os.IsNotExist(err) {
		return "", ErrNotFound
	}
	return value.Value, err
}
func (s Development) Set(key, value string) error {
	path, err := s.path(key)
	if err != nil {
		return err
	}
	return core.WritePrivate(path, map[string]string{"value": value})
}
func (s Development) Delete(key string) error {
	path, err := s.path(key)
	if err != nil {
		return err
	}
	if err = core.CheckPrivate(path, false); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return os.Remove(path)
}
func Open(dir string, config core.Config) (Store, error) {
	if config.DevelopmentStore {
		if err := core.CheckURL(config.APIURL, true); err != nil {
			return nil, err
		}
		return Development{dir}, nil
	}
	return Native(config.InstallationID)
}
func Binding(store Store) (core.Binding, error) {
	raw, err := store.Get("backend")
	if err != nil {
		return core.Binding{}, err
	}
	var value core.Binding
	if err := core.StrictJSON([]byte(raw), &value); err != nil {
		return value, err
	}
	if !core.ValidUUID(value.AgentID) || !core.ValidUUID(value.WorkspaceID) || len(value.Token) != 43 || value.Generation < 1 {
		return value, errors.New("invalid stored identity")
	}
	return value, nil
}
func SaveBinding(store Store, value core.Binding) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return store.Set("backend", string(raw))
}
