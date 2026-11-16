package localipc

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"netsentry.local/agent/internal/core"
	"time"
)

const MaxFrame = 65536
const Context = "netsentry-local/v1"

type Challenge struct {
	Protocol   string `json:"protocol"`
	Version    int    `json:"version"`
	Nonce      string `json:"nonce"`
	InstanceID string `json:"instanceId"`
}
type Proof struct {
	Version     int    `json:"version"`
	ClientNonce string `json:"clientNonce"`
	Proof       string `json:"proof"`
}
type Accepted struct {
	Authenticated bool   `json:"authenticated"`
	Proof         string `json:"proof"`
}
type Request struct {
	SchemaVersion int             `json:"schemaVersion"`
	RequestID     string          `json:"requestId"`
	Method        string          `json:"method"`
	Payload       json.RawMessage `json:"payload"`
}
type Response struct {
	SchemaVersion int    `json:"schemaVersion"`
	RequestID     string `json:"requestId"`
	OK            bool   `json:"ok"`
	Code          string `json:"code"`
	Data          any    `json:"data"`
}

func Read(reader io.Reader, target any) error {
	var size [4]byte
	if _, err := io.ReadFull(reader, size[:]); err != nil {
		return err
	}
	length := binary.BigEndian.Uint32(size[:])
	if length == 0 || length > MaxFrame {
		return errors.New("invalid local frame size")
	}
	data := make([]byte, length)
	if _, err := io.ReadFull(reader, data); err != nil {
		return err
	}
	return core.StrictJSON(data, target)
}
func Write(writer io.Writer, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if len(data) > MaxFrame {
		return errors.New("local response exceeds limit")
	}
	var size [4]byte
	binary.BigEndian.PutUint32(size[:], uint32(len(data)))
	data = append(size[:], data...)
	for len(data) > 0 {
		n, err := writer.Write(data)
		if err != nil {
			return err
		}
		if n == 0 {
			return io.ErrShortWrite
		}
		data = data[n:]
	}
	return nil
}
func Digest(secret, context string, challenge Challenge, clientNonce string) (string, error) {
	key, err := hex.DecodeString(secret)
	if err != nil || len(key) != 32 {
		return "", errors.New("invalid local credential")
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(context + "\n" + challenge.Nonce + "\n" + challenge.InstanceID + "\n" + clientNonce))
	return hex.EncodeToString(mac.Sum(nil)), nil
}
func nonce() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	return hex.EncodeToString(b), err
}
func Authenticate(conn net.Conn, secret string) error {
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	serverNonce, err := nonce()
	if err != nil {
		return err
	}
	instance, err := nonce()
	if err != nil {
		return err
	}
	challenge := Challenge{Protocol: "netsentry-local", Version: 1, Nonce: serverNonce, InstanceID: instance}
	if err := Write(conn, challenge); err != nil {
		return err
	}
	var proof Proof
	if err := Read(conn, &proof); err != nil {
		return err
	}
	if proof.Version != 1 || len(proof.ClientNonce) != 64 {
		return errors.New("invalid local proof")
	}
	if _, err := hex.DecodeString(proof.ClientNonce); err != nil {
		return err
	}
	expected, err := Digest(secret, Context, challenge, proof.ClientNonce)
	if err != nil || !hmac.Equal([]byte(expected), []byte(proof.Proof)) {
		return errors.New("local authentication failed")
	}
	ack, err := Digest(secret, Context+"/accepted", challenge, proof.ClientNonce)
	if err != nil {
		return err
	}
	return Write(conn, Accepted{Authenticated: true, Proof: ack})
}
