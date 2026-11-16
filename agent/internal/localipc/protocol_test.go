package localipc

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCrossLanguageVector(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "contracts", "fixtures", "local-auth.v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Secret          string    `json:"secret"`
		Challenge       Challenge `json:"challenge"`
		ClientNonce     string    `json:"clientNonce"`
		Proof           string    `json:"proof"`
		Acknowledgement string    `json:"acknowledgement"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	proof, _ := Digest(fixture.Secret, Context, fixture.Challenge, fixture.ClientNonce)
	ack, _ := Digest(fixture.Secret, Context+"/accepted", fixture.Challenge, fixture.ClientNonce)
	if proof != fixture.Proof || ack != fixture.Acknowledgement {
		t.Fatal("wire HMAC vector mismatch")
	}
}
func TestChallengeProofAndReplay(t *testing.T) {
	secret := strings.Repeat("11", 32)
	var recorded Proof
	for attempt := 0; attempt < 2; attempt++ {
		server, client := net.Pipe()
		result := make(chan error, 1)
		go func() { result <- Authenticate(server, secret); server.Close() }()
		var challenge Challenge
		if err := Read(client, &challenge); err != nil {
			t.Fatal(err)
		}
		proof := recorded
		if attempt == 0 {
			proof = Proof{Version: 1, ClientNonce: strings.Repeat("22", 32)}
			proof.Proof, _ = Digest(secret, Context, challenge, proof.ClientNonce)
			recorded = proof
		}
		if err := Write(client, proof); err != nil {
			t.Fatal(err)
		}
		var ack Accepted
		err := Read(client, &ack)
		client.Close()
		authErr := <-result
		if attempt == 0 {
			if err != nil || authErr != nil || !ack.Authenticated {
				t.Fatal("valid authentication failed", err, authErr)
			}
		} else if authErr == nil || err == nil {
			t.Fatal("replayed proof accepted")
		}
	}
}
func TestFrameBoundsAndStrictJSON(t *testing.T) {
	for _, size := range []uint32{0, MaxFrame + 1} {
		var header [4]byte
		binary.BigEndian.PutUint32(header[:], size)
		var target any
		if Read(bytes.NewReader(header[:]), &target) == nil {
			t.Fatal("oversized/empty frame accepted")
		}
	}
	payload := []byte(`{"version":1,"version":2}`)
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(payload)))
	var proof Proof
	if Read(bytes.NewReader(append(header[:], payload...)), &proof) == nil {
		t.Fatal("duplicate keys accepted")
	}
	var empty io.Reader = bytes.NewReader(nil)
	if Read(empty, &proof) == nil {
		t.Fatal("truncated frame accepted")
	}
}
