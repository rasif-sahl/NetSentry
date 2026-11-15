# NetSentry Go agent

The shared core will own identity, pairing, connections, heartbeats and local buffering. Independent `internal/modules/network` and `internal/modules/developer` packages reserve the two module boundaries.

This scaffold only writes a capability report to stdout and exits. Both modules are disabled and unavailable. It does not scan networks, collect process information, contact the backend, stop services, or install a background service.

With an existing Go 1.23+ toolchain:

```sh
cd agent
GOTOOLCHAIN=local go run ./cmd/netsentry-agent
GOTOOLCHAIN=local go vet ./...
GOTOOLCHAIN=local go test ./...
```

There are no external Go dependencies. `GOTOOLCHAIN=local` prevents automatic Go toolchain downloads. Go is currently unavailable on the development machine, so build/runtime verification is pending. See `docs/validation/phase-0.md`.
