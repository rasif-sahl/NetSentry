package main

import (
	"encoding/json"
	"fmt"
	"os"

	"netsentry.local/agent/internal/capability"
	"netsentry.local/agent/internal/modules/developer"
	"netsentry.local/agent/internal/modules/network"
)

func main() {
	report := capability.Report{
		SchemaVersion: 1,
		Modules: []capability.Module{network.Capability(), developer.Capability()},
	}
	if err := json.NewEncoder(os.Stdout).Encode(report); err != nil {
		fmt.Fprintln(os.Stderr, "Could not write agent capability report:", err)
		os.Exit(1)
	}
}
