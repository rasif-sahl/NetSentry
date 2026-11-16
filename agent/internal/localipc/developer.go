package localipc

import (
	"bytes"
	"context"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/modules/developer"
	"netsentry.local/agent/internal/runner"
)

func DispatchDeveloper(ctx context.Context, request Request, agent *runner.Runner) Response {
	response := Response{SchemaVersion: 3, RequestID: request.RequestID, OK: true, Code: "OK"}
	invalid := func() Response { response.OK = false; response.Code = "INVALID_REQUEST"; return response }
	payload := bytes.TrimSpace(request.Payload)
	if len(payload) == 0 || payload[0] != '{' {
		return invalid()
	}
	var err error
	switch request.Method {
	case "list_services":
		var input struct {
			Query  *string `json:"query"`
			Offset *int    `json:"offset"`
		}
		if core.StrictJSON(payload, &input) != nil || input.Query == nil || input.Offset == nil || len([]rune(*input.Query)) > 100 || *input.Offset < 0 || *input.Offset > 256 {
			return invalid()
		}
		response.Data, err = agent.Services(ctx, *input.Query, *input.Offset)
	case "request_stop":
		var input struct {
			ActionID        string `json:"actionId"`
			ServiceID       string `json:"serviceId"`
			ObservationID   string `json:"observationId"`
			Mode            string `json:"mode"`
			IncludeChildren *bool  `json:"includeChildren"`
		}
		if core.StrictJSON(payload, &input) != nil || input.IncludeChildren == nil || !core.ValidUUID(input.ActionID) || len(input.ServiceID) != 64 || !core.ValidUUID(input.ObservationID) || (input.Mode != "graceful" && input.Mode != "force") {
			return invalid()
		}
		response.Data, err = agent.StopService(ctx, developer.StopInput{ActionID: input.ActionID, ServiceID: input.ServiceID, ObservationID: input.ObservationID, Mode: input.Mode, IncludeChildren: *input.IncludeChildren})
	case "set_project":
		var input struct {
			ServiceID     string  `json:"serviceId"`
			ObservationID string  `json:"observationId"`
			Label         *string `json:"label"`
		}
		if core.StrictJSON(payload, &input) != nil || len(input.ServiceID) != 64 || !core.ValidUUID(input.ObservationID) || input.Label == nil || len([]rune(*input.Label)) > 100 {
			return invalid()
		}
		err = agent.ServiceProject(ctx, input.ServiceID, input.ObservationID, *input.Label)
		if err == nil {
			response.Data = map[string]bool{"saved": true}
		}
	case "get_action_history":
		var input struct {
			Offset *int `json:"offset"`
		}
		if core.StrictJSON(payload, &input) != nil || (input.Offset != nil && (*input.Offset < 0 || *input.Offset > 75)) {
			return invalid()
		}
		var entries []developer.Action
		entries, err = agent.ServiceHistory(ctx)
		if err == nil {
			offset := 0
			if input.Offset != nil {
				offset = *input.Offset
			}
			if offset >= len(entries) {
				response.Data = []developer.Action{}
			} else {
				response.Data = entries[offset:min(offset+25, len(entries))]
			}
		}
	case "set_local_control":
		var input struct {
			Allowed *bool `json:"allowed"`
		}
		if core.StrictJSON(payload, &input) != nil || input.Allowed == nil {
			return invalid()
		}
		err = agent.LocalControl(*input.Allowed)
		if err == nil {
			response.Data = map[string]bool{"allowed": *input.Allowed}
		}
	default:
		return invalid()
	}
	if err != nil {
		response.OK = false
		response.Data = nil
		response.Code = "DEVELOPER_UNAVAILABLE"
		for _, code := range []string{"MODULE_DISABLED", "AUTHORIZATION_UNAVAILABLE", "CONFIGURATION_REQUIRED", "LOCAL_CONTROL_DISABLED", "PLATFORM_UNAVAILABLE", "STALE_OBSERVATION", "ACTION_CONFLICT", "INVALID_REQUEST", "HISTORY_WRITE_FAILED", "ASSOCIATION_LIMIT", "PROTECTED_PROCESS", "UNSUPPORTED_RUNTIME"} {
			if err.Error() == code {
				response.Code = code
				break
			}
		}
	}
	return response
}
