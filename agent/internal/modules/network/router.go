package network

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/netip"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type RouterConfig struct {
	ID            string  `json:"id"`
	Revision      int     `json:"revision"`
	Adapter       string  `json:"adapter"`
	URL           string  `json:"url"`
	InterfaceName string  `json:"interfaceName"`
	CACertificate string  `json:"caCertificate"`
	Username      string  `json:"username"`
	Password      string  `json:"password"`
	TestRequestID *string `json:"testRequestId"`
}
type RouterResult struct {
	RouterID      string  `json:"routerId"`
	Revision      int     `json:"revision"`
	Status        string  `json:"status"`
	WANUp         *bool   `json:"wanUp"`
	UptimeSeconds *string `json:"uptimeSeconds"`
	RXBytes       *string `json:"rxBytes"`
	TXBytes       *string `json:"txBytes"`
	Model         *string `json:"model"`
	Firmware      *string `json:"firmware"`
	TestRequestID *string `json:"testRequestId"`
}

var interfaceName = regexp.MustCompile(`^[a-zA-Z0-9_]{1,32}$`)
var deviceName = regexp.MustCompile(`^[a-zA-Z0-9_.:-]{1,32}$`)
var sessionID = regexp.MustCompile(`^[a-fA-F0-9]{32}$`)

func RouterClient(config RouterConfig, cidrs []string) (*http.Client, error) {
	u, e := url.Parse(config.URL)
	if e != nil || u.Scheme != "https" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.RawPath != "" || u.Path != "/ubus" || !Allowed(cidrs, u.Hostname()) || config.Adapter != "openwrt-ubus-v1" || !interfaceName.MatchString(config.InterfaceName) || len(config.Username) < 1 || len(config.Username) > 100 || len(config.Password) < 1 || len(config.Password) > 256 || len(config.CACertificate) > 8192 {
		return nil, errors.New("unsupported router scope")
	}
	ip, e := netip.ParseAddr(u.Hostname())
	if e != nil || !ip.Is4() {
		return nil, errors.New("literal private router IPv4 required")
	}
	roots, e := x509.SystemCertPool()
	if e != nil {
		roots = x509.NewCertPool()
	}
	if config.CACertificate != "" && !roots.AppendCertsFromPEM([]byte(config.CACertificate)) {
		return nil, errors.New("invalid router CA")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: roots}
	transport.DisableKeepAlives = true
	transport.ResponseHeaderTimeout = 3 * time.Second
	return &http.Client{Transport: transport, Timeout: 4 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}, nil
}

type rpcFailure struct{ status string }

func (e rpcFailure) Error() string { return e.status }
func rpc(ctx context.Context, client *http.Client, target, session, object, method string, input any) (map[string]json.RawMessage, error) {
	data, e := json.Marshal(struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Method  string `json:"method"`
		Params  []any  `json:"params"`
	}{"2.0", 1, "call", []any{session, object, method, input}})
	if e != nil {
		return nil, rpcFailure{"unsupported"}
	}
	req, e := http.NewRequestWithContext(ctx, "POST", target, bytes.NewReader(data))
	if e != nil {
		return nil, rpcFailure{"unsupported"}
	}
	req.Header.Set("Content-Type", "application/json")
	response, e := client.Do(req)
	if e != nil {
		var certificate *tls.CertificateVerificationError
		if errors.As(e, &certificate) {
			return nil, rpcFailure{"tls_failed"}
		}
		return nil, rpcFailure{"unavailable"}
	}
	defer response.Body.Close()
	if response.StatusCode == 401 || response.StatusCode == 403 {
		return nil, rpcFailure{"auth_failed"}
	}
	if response.StatusCode != 200 {
		return nil, rpcFailure{"unavailable"}
	}
	raw, e := io.ReadAll(io.LimitReader(response.Body, 65537))
	if e != nil || len(raw) > 65536 {
		return nil, rpcFailure{"unsupported"}
	}
	var envelope struct {
		JSONRPC string            `json:"jsonrpc"`
		ID      int               `json:"id"`
		Result  []json.RawMessage `json:"result"`
		Error   json.RawMessage   `json:"error"`
	}
	if json.Unmarshal(raw, &envelope) != nil || envelope.JSONRPC != "2.0" || envelope.ID != 1 || (len(envelope.Error) > 0 && string(envelope.Error) != "null") || len(envelope.Result) == 0 {
		return nil, rpcFailure{"unsupported"}
	}
	var status int
	if json.Unmarshal(envelope.Result[0], &status) != nil {
		return nil, rpcFailure{"unsupported"}
	}
	if status == 6 {
		return nil, rpcFailure{"auth_failed"}
	}
	if status != 0 {
		return nil, rpcFailure{"unsupported"}
	}
	if len(envelope.Result) != 2 {
		return nil, rpcFailure{"unsupported"}
	}
	var result map[string]json.RawMessage
	if json.Unmarshal(envelope.Result[1], &result) != nil || result == nil {
		return nil, rpcFailure{"unsupported"}
	}
	return result, nil
}
func stringField(data map[string]json.RawMessage, key string) *string {
	var value string
	if json.Unmarshal(data[key], &value) != nil || len(value) > 100 || strings.IndexFunc(value, unicode.IsControl) >= 0 {
		return nil
	}
	return &value
}
func unsignedField(data map[string]json.RawMessage, key string) *string {
	var number json.Number
	if json.Unmarshal(data[key], &number) != nil {
		return nil
	}
	value, e := strconv.ParseUint(string(number), 10, 64)
	if e != nil {
		return nil
	}
	text := strconv.FormatUint(value, 10)
	return &text
}
func PollRouter(ctx context.Context, config RouterConfig, cidrs []string) RouterResult {
	client, e := RouterClient(config, cidrs)
	if e != nil {
		return RouterResult{RouterID: config.ID, Revision: config.Revision, Status: "unsupported", TestRequestID: config.TestRequestID}
	}
	return pollRouter(ctx, client, config)
}
func pollRouter(ctx context.Context, client *http.Client, config RouterConfig) RouterResult {
	out := RouterResult{RouterID: config.ID, Revision: config.Revision, Status: "unavailable", TestRequestID: config.TestRequestID}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	fail := func(e error) RouterResult {
		var f rpcFailure
		if errors.As(e, &f) {
			out.Status = f.status
		}
		out.WANUp = nil
		out.UptimeSeconds = nil
		out.RXBytes = nil
		out.TXBytes = nil
		return out
	}
	login, e := rpc(ctx, client, config.URL, strings.Repeat("0", 32), "session", "login", map[string]any{"username": config.Username, "password": config.Password, "timeout": 30})
	if e != nil {
		return fail(e)
	}
	token := stringField(login, "ubus_rpc_session")
	if token == nil || !sessionID.MatchString(*token) {
		out.Status = "unsupported"
		return out
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_, _ = rpc(cleanup, client, config.URL, *token, "session", "destroy", map[string]any{"ubus_rpc_session": *token})
	}()
	board, e := rpc(ctx, client, config.URL, *token, "system", "board", map[string]any{})
	if e == nil {
		out.Model = stringField(board, "model")
		var release map[string]json.RawMessage
		if json.Unmarshal(board["release"], &release) == nil {
			out.Firmware = stringField(release, "version")
		}
	}
	wan, e := rpc(ctx, client, config.URL, *token, "network.interface."+config.InterfaceName, "status", map[string]any{})
	if e != nil {
		return fail(e)
	}
	var up bool
	if (string(wan["up"]) != "true" && string(wan["up"]) != "false") || json.Unmarshal(wan["up"], &up) != nil {
		out.Status = "unsupported"
		return out
	}
	out.WANUp = &up
	out.UptimeSeconds = unsignedField(wan, "uptime")
	if out.UptimeSeconds != nil && len(*out.UptimeSeconds) > 12 {
		out.UptimeSeconds = nil
	}
	device := stringField(wan, "l3_device")
	if device == nil {
		device = stringField(wan, "device")
	}
	if device == nil || !deviceName.MatchString(*device) {
		out.Status = "unsupported"
		out.WANUp = nil
		out.UptimeSeconds = nil
		return out
	}
	status, e := rpc(ctx, client, config.URL, *token, "network.device", "status", map[string]any{"name": *device})
	if e != nil {
		return fail(e)
	}
	var statistics map[string]json.RawMessage
	if json.Unmarshal(status["statistics"], &statistics) != nil {
		out.Status = "unsupported"
		out.WANUp = nil
		out.UptimeSeconds = nil
		return out
	}
	out.RXBytes = unsignedField(statistics, "rx_bytes")
	out.TXBytes = unsignedField(statistics, "tx_bytes")
	if out.RXBytes == nil || out.TXBytes == nil {
		out.Status = "unsupported"
		out.WANUp = nil
		out.UptimeSeconds = nil
		out.RXBytes = nil
		out.TXBytes = nil
		return out
	}
	out.Status = "ok"
	return out
}
