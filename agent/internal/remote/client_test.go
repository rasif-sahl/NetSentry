package remote

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestTLSAndRedirectBoundary(t *testing.T) {
	tls := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{}`)) }))
	defer tls.Close()
	client, err := New(tls.URL, false)
	if err != nil {
		t.Fatal(err)
	}
	var output struct{}
	if err := client.Request(context.Background(), "GET", "/", "synthetic", nil, &output); err == nil {
		t.Fatal("untrusted TLS certificate accepted")
	}
	var leaked atomic.Bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { leaked.Store(true) }))
	defer target.Close()
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
	}))
	defer redirect.Close()
	client, _ = New(redirect.URL, true)
	err = client.Request(context.Background(), "GET", "/", "synthetic", nil, &output)
	var failure *Failure
	if !errors.As(err, &failure) || failure.Status != 307 || leaked.Load() {
		t.Fatalf("redirect boundary failed: %v", err)
	}
}
