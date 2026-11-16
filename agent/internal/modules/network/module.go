package network

import "netsentry.local/agent/internal/capability"

func Capability() capability.Module {
	return capability.Module{
		ID:      "network",
		Enabled: false,
		Status:  "temporarily_unavailable",
		Reason:  "Passive discovery and router adapters require separate named-network authorization and local consent.",
	}
}
