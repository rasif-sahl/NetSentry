package localipc

import (
	"bytes"
	"fmt"
	"netsentry.local/agent/internal/core"
	"netsentry.local/agent/internal/modules/developer"
	"strings"
	"testing"
	"time"
)

func TestHistoryPageFitsBoundedFrame(t *testing.T) {
	actions := []developer.Action{}
	for i := 0; i < 25; i++ {
		actions = append(actions, developer.Action{ActionID: core.UUID(), ServiceID: strings.Repeat("a", 64), Mode: "graceful", PID: 2147483647, Project: strings.Repeat("<", 100), RequestedAt: core.Timestamp(time.Now()), CompletedAt: core.Timestamp(time.Now()), Outcome: "stopped_unverified_listeners", TargetCount: 17})
	}
	var frame bytes.Buffer
	response := Response{SchemaVersion: 3, RequestID: core.UUID(), OK: true, Code: "OK", Data: actions}
	if err := Write(&frame, response); err != nil {
		t.Fatal("history page exceeded frame limit", err)
	}
	var decoded Response
	if err := Read(&frame, &decoded); err != nil {
		t.Fatal(err)
	}
	if fmt.Sprint(decoded.Code) != "OK" {
		t.Fatal("history frame corrupted")
	}
}
