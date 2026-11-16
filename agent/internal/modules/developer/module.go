package developer

import "netsentry.local/agent/internal/capability"

func Capability() capability.Module {
	return capability.Module{
		ID:      "developer",
		Enabled: false,
		Status:  "temporarily_unavailable",
		Reason:  "Developer Tools is disabled in this startup report. Use authenticated desktop inventory for local platform availability.",
	}
}
