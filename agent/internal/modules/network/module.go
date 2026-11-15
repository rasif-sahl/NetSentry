package network

import "netsentry.local/agent/internal/capability"

func Capability() capability.Module {
	return capability.Module{
		ID: "network", Enabled: false, Status: "temporarily_unavailable",
		Reason: "Network monitoring is not implemented in this scaffold.",
	}
}
