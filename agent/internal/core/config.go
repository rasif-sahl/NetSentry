package core

import (
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

const Version = "0.5.0"
const TimeLayout = "2006-01-02T15:04:05.000Z"

type Modules struct {
	Network   bool `json:"network"`
	Developer bool `json:"developer"`
}
type Config struct {
	SchemaVersion     int     `json:"schemaVersion"`
	InstallationID    string  `json:"installationId"`
	APIURL            string  `json:"apiUrl"`
	Requested         Modules `json:"requested"`
	BackgroundAllowed bool    `json:"backgroundAllowed"`
	DevelopmentStore  bool    `json:"developmentStore"`
}
type Binding struct {
	AgentID     string `json:"agentId"`
	WorkspaceID string `json:"workspaceId"`
	Generation  int    `json:"generation"`
	Token       string `json:"token"`
	APIURL      string `json:"apiUrl"`
}
type RemoteConfig struct {
	SchemaVersion        int     `json:"schemaVersion"`
	AgentID              string  `json:"agentId"`
	WorkspaceID          string  `json:"workspaceId"`
	Generation           int     `json:"generation"`
	Modules              Modules `json:"modules"`
	BackgroundAllowed    bool    `json:"backgroundAllowed"`
	RemoteControlAllowed bool    `json:"remoteControlAllowed"`
	HeartbeatSeconds     int     `json:"heartbeatSeconds"`
	MaxBufferedEvents    int     `json:"maxBufferedEvents"`
	MaxBufferBytes       int     `json:"maxBufferBytes"`
	MaxEventAgeSeconds   int     `json:"maxEventAgeSeconds"`
	MaxBatchEvents       int     `json:"maxBatchEvents"`
	MaxAttempts          int     `json:"maxAttempts"`
	MaxBackoffSeconds    int     `json:"maxBackoffSeconds"`
}

func DefaultDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "NetSentry", "agent"), nil
}
func CheckURL(raw string, development bool) error {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.RawPath != "" {
		return errors.New("invalid backend API URL")
	}
	loopback := u.Hostname() == "127.0.0.1" || u.Hostname() == "::1" || u.Hostname() == "localhost"
	if u.Scheme != "https" && !(development && u.Scheme == "http" && loopback) {
		return errors.New("backend requires HTTPS; explicit development storage permits loopback HTTP only")
	}
	if development && !loopback {
		return errors.New("development credential storage is restricted to loopback")
	}
	return nil
}
func Initialize(dir, apiURL string, development bool) (Config, error) {
	if runtime.GOARCH != "amd64" && runtime.GOARCH != "arm64" {
		return Config{}, errors.New("unsupported agent architecture")
	}
	if err := CheckURL(apiURL, development); err != nil {
		return Config{}, err
	}
	if err := PrivateDir(dir); err != nil {
		return Config{}, err
	}
	claim, err := os.OpenFile(filepath.Join(dir, "config.json"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return Config{}, errors.New("installation already initialized or state directory unavailable")
	}
	claim.Close()
	config := Config{SchemaVersion: 1, InstallationID: UUID(), APIURL: apiURL, DevelopmentStore: development}
	if err := WritePrivate(filepath.Join(dir, "config.json"), config); err != nil {
		os.Remove(filepath.Join(dir, "config.json"))
		return Config{}, err
	}
	return config, nil
}
func LoadConfig(dir string) (Config, error) {
	var config Config
	if err := CheckPrivate(dir, true); err != nil {
		return config, err
	}
	if err := ReadPrivate(filepath.Join(dir, "config.json"), 4096, &config); err != nil {
		return config, err
	}
	if config.SchemaVersion != 1 || !ValidUUID(config.InstallationID) {
		return config, errors.New("unsupported installation configuration")
	}
	return config, CheckURL(config.APIURL, config.DevelopmentStore)
}
func Timestamp(now time.Time) string { return now.UTC().Format(TimeLayout) }
