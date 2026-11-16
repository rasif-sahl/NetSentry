package main

import (
	"encoding/base64"
	"errors"
	"flag"
	"io"
	"netsentry.local/agent/internal/packageverify"
	"os"
	"runtime"
	"time"
)

func limitedFile(path string, limit int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, errors.New("verification input unavailable")
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil || int64(len(data)) > limit {
		return nil, errors.New("verification input exceeds limit")
	}
	return data, nil
}
func verifyCommand(args []string) error {
	flags := flag.NewFlagSet("verify-package", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	manifest := flags.String("manifest", "", "")
	signature := flags.String("signature", "", "")
	publicKey := flags.String("public-key", "", "")
	artifact := flags.String("artifact", "", "")
	minimum := flags.Uint64("minimum-release", 0, "")
	if flags.Parse(args) != nil || flags.NArg() != 0 || *minimum == 0 {
		return errors.New("supply manifest, detached signature, pinned public key, artifact and positive minimum-release")
	}
	raw, err := limitedFile(*manifest, 16384)
	if err != nil {
		return err
	}
	sig, err := limitedFile(*signature, 128)
	if err != nil {
		return err
	}
	key, err := limitedFile(*publicKey, 128)
	if err != nil {
		return err
	}
	decodedKey, err := base64.StdEncoding.DecodeString(string(key))
	if err != nil {
		return errors.New("invalid pinned public key")
	}
	decodedSig, err := base64.StdEncoding.DecodeString(string(sig))
	if err != nil {
		return errors.New("invalid detached signature")
	}
	result, err := packageverify.Verify(raw, decodedSig, decodedKey, *artifact, runtime.GOOS, runtime.GOARCH, *minimum, time.Now())
	if err != nil {
		return err
	}
	return emit(map[string]any{"verified": true, "manifest": result, "installed": false})
}
