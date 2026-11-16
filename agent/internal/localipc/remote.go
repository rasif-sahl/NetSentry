package localipc

import (
	"bytes"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/runner"
)

func DispatchRemote(request Request, agent *runner.Runner) Response {
	out := Response{SchemaVersion: 4, RequestID: request.RequestID, OK: true, Code: "OK"}
	invalid := func() Response { out.OK = false; out.Code = "INVALID_REQUEST"; return out }
	value := bytes.TrimSpace(request.Payload)
	if len(value) == 0 || value[0] != '{' {
		return invalid()
	}
	switch request.Method {
	case "get_remote_preferences":
		var input struct{}
		if core.StrictJSON(request.Payload, &input) != nil {
			return invalid()
		}
		out.Data = agent.RemoteStatus()
	case "set_remote_preferences":
		var input struct {
			Sharing           *bool  `json:"sharing"`
			Control           *bool  `json:"control"`
			Accepted          *bool  `json:"accepted"`
			DisclosureVersion string `json:"disclosureVersion"`
		}
		if core.StrictJSON(request.Payload, &input) != nil || input.Sharing == nil || input.Control == nil || input.Accepted == nil || input.DisclosureVersion != "developer-sharing-v1" {
			return invalid()
		}
		if err := agent.RemotePreferences(*input.Sharing, *input.Control, *input.Accepted); err != nil {
			out.OK = false
			out.Code = "REMOTE_SETTINGS_FAILED"
		} else {
			out.Data = agent.RemoteStatus()
		}
	default:
		return invalid()
	}
	return out
}
