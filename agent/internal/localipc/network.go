package localipc

import (
	"bytes"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/runner"
)

func DispatchNetwork(request Request, agent *runner.Runner) Response {
	out := Response{SchemaVersion: 5, RequestID: request.RequestID, OK: true, Code: "OK"}
	invalid := func() Response { out.OK = false; out.Code = "INVALID_REQUEST"; return out }
	value := bytes.TrimSpace(request.Payload)
	if len(value) == 0 || value[0] != '{' {
		return invalid()
	}
	switch request.Method {
	case "get_network_preferences":
		var input struct{}
		if core.StrictJSON(request.Payload, &input) != nil {
			return invalid()
		}
		out.Data = agent.NetworkStatus()
	case "set_network_preferences":
		var input struct {
			Sharing           *bool  `json:"sharing"`
			NetworkID         string `json:"networkId"`
			Accepted          *bool  `json:"accepted"`
			DisclosureVersion string `json:"disclosureVersion"`
		}
		if core.StrictJSON(request.Payload, &input) != nil || input.Sharing == nil || input.Accepted == nil || input.DisclosureVersion != "network-sharing-v1" {
			return invalid()
		}
		if agent.NetworkPreferences(*input.Sharing, input.NetworkID, *input.Accepted) != nil {
			out.OK = false
			out.Code = "NETWORK_SETTINGS_FAILED"
		} else {
			out.Data = agent.NetworkStatus()
		}
	default:
		return invalid()
	}
	return out
}
