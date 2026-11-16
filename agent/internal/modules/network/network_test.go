package network

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPassiveCacheAndRouteFixtures(t *testing.T) {
	scope := []string{"192.168.1.0/24"}
	for _, s := range []string{"192.168.1.0/15", "172.16.0.0/11", "10.0.0.0/7", "127.0.0.0/8", "10.0.0.1/32"} {
		if ValidateScope([]string{s}) == nil {
			t.Fatalf("accepted %s", s)
		}
	}
	if ValidateScope(scope) != nil || !Allowed(scope, "192.168.1.25") || Allowed(scope, "192.168.2.25") {
		t.Fatal("scope")
	}
	linux := "IP address HW type Flags HW address Mask Device\n192.168.1.2 0x1 0x2 02:00:00:00:00:01 * eth0\n192.168.1.3 0x1 0x0 00:00:00:00:00:00 * eth0\n192.168.2.2 0x1 0x2 02:00:00:00:00:02 * eth0\n192.168.1.4 0x1 0x2 ff:ff:ff:ff:ff:ff * eth0"
	if got := ParseARP(linux, true, scope); len(got) != 1 || got[0].Evidence != "cached" {
		t.Fatalf("%+v", got)
	}
	darwin := "? (192.168.1.2) at 2:0:0:0:0:1 on en0 ifscope [ethernet]\n? (192.168.1.3) at (incomplete) on en0 ifscope [ethernet]"
	// macOS uses unpadded hardware octets; normalize these without a lookup.
	if got := ParseARP(darwin, false, scope); len(got) != 1 {
		t.Fatalf("macOS cache not parsed: %+v", got)
	}
	name, ip := LinuxGateway("eth0 00000000 0101A8C0 0003 0 0 0 00000000")
	if name != "eth0" || ip != "192.168.1.1" {
		t.Fatal(name, ip)
	}
	name, ip = DarwinGateway(" gateway: 192.168.1.1\n interface: en0")
	if name != "en0" || ip != "192.168.1.1" {
		t.Fatal(name, ip)
	}
}
func routerFixture(t *testing.T, handler http.Handler) (RouterConfig, *http.Client) {
	t.Helper()
	key, e := rsa.GenerateKey(rand.Reader, 2048)
	if e != nil {
		t.Fatal(e)
	}
	now := time.Now()
	cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "Synthetic router fixture"}, NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, IPAddresses: []net.IP{net.ParseIP("192.168.1.1")}}
	der, e := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
	if e != nil {
		t.Fatal(e)
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	pair, e := tls.X509KeyPair(certPEM, privatePEM)
	if e != nil {
		t.Fatal(e)
	}
	server := httptest.NewUnstartedServer(handler)
	server.TLS = &tls.Config{Certificates: []tls.Certificate{pair}}
	server.StartTLS()
	t.Cleanup(server.Close)
	config := RouterConfig{ID: "11111111-1111-4111-8111-111111111111", Revision: 1, Adapter: "openwrt-ubus-v1", URL: "https://192.168.1.1/ubus", InterfaceName: "wan", CACertificate: string(certPEM), Username: "synthetic", Password: "secret-fixture"}
	client, e := RouterClient(config, []string{"192.168.1.0/24"})
	if e != nil {
		t.Fatal(e)
	}
	// Keep production certificate verification and private-IP SNI; redirect only the test socket to loopback.
	client.Transport.(*http.Transport).DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		if address != "192.168.1.1:443" {
			t.Errorf("unexpected target %s", address)
		}
		return (&net.Dialer{}).DialContext(ctx, network, server.Listener.Addr().String())
	}
	return config, client
}
func TestReadOnlyRouterTLSAndExactCounters(t *testing.T) {
	calls := []string{}
	config, client := routerFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Params []json.RawMessage `json:"params"`
		}
		if json.NewDecoder(r.Body).Decode(&input) != nil || len(input.Params) != 4 {
			t.Error("bad request")
			w.WriteHeader(400)
			return
		}
		var object, method string
		_ = json.Unmarshal(input.Params[1], &object)
		_ = json.Unmarshal(input.Params[2], &method)
		calls = append(calls, object+"."+method)
		data := "{}"
		switch object + "." + method {
		case "session.login":
			data = `{"ubus_rpc_session":"11111111111111111111111111111111"}`
		case "system.board":
			data = `{"model":"Synthetic fixture","release":{"version":"fixture-only"}}`
		case "network.interface.wan.status":
			data = `{"up":true,"uptime":100,"l3_device":"eth0.2"}`
		case "network.device.status":
			data = `{"statistics":{"rx_bytes":18446744073709551615,"tx_bytes":9007199254740993}}`
		case "session.destroy":
		default:
			t.Errorf("non-read-only call: %s.%s", object, method)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":[0,` + data + `]}`))
	}))
	got := pollRouter(context.Background(), client, config)
	if got.Status != "ok" || got.RXBytes == nil || *got.RXBytes != "18446744073709551615" || *got.TXBytes != "9007199254740993" {
		t.Fatalf("%+v", got)
	}
	if strings.Join(calls, ",") != "session.login,system.board,network.interface.wan.status,network.device.status,session.destroy" {
		t.Fatal(calls)
	}
	for _, url := range []string{"http://192.168.1.1/ubus", "https://127.0.0.1/ubus", "https://router.local/ubus", "https://192.168.2.1/ubus", "https://192.168.1.1/ubus?x=y", "https://192.168.1.1/admin"} {
		bad := config
		bad.URL = url
		if _, e := RouterClient(bad, []string{"192.168.1.0/24"}); e == nil {
			t.Fatalf("allowed %s", url)
		}
	}
}
func TestRouterFailureNeverReturnsActiveCounters(t *testing.T) {
	for _, fixture := range []struct{ name, body, want string }{
		{"permission", `{"jsonrpc":"2.0","id":1,"result":[6]}`, "auth_failed"},
		{"malformed", `{"jsonrpc":"2.0","id":1,"result":[0,{}],"error":{"message":"secret"}}`, "unsupported"},
		{"oversize", strings.Repeat("x", 65537), "unsupported"},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			config, client := routerFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(fixture.body)) }))
			out := pollRouter(context.Background(), client, config)
			if out.Status != fixture.want || out.RXBytes != nil || out.WANUp != nil {
				t.Fatalf("%+v", out)
			}
		})
	}
	config, client := routerFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "https://192.168.2.1/ubus", 302) }))
	out := pollRouter(context.Background(), client, config)
	if out.Status != "unavailable" {
		t.Fatal(out)
	}
	config.CACertificate = ""
	untrusted, _ := RouterClient(config, []string{"192.168.1.0/24"})
	untrusted.Transport.(*http.Transport).DialContext = client.Transport.(*http.Transport).DialContext
	if out = pollRouter(context.Background(), untrusted, config); out.Status != "tls_failed" {
		t.Fatal(out)
	}
}
