package developer

import "netsentry.local/agent/internal/capability"

func Capability() capability.Module {
	return capability.Module{
		ID: "developer", Enabled: false, Status: "temporarily_unavailable",
		Reason: "Developer tools are not implemented in this scaffold.",
	}
}
