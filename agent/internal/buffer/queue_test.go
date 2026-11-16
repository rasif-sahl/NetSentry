//go:build !windows

package buffer

import (
	"netsentry.local/agent/internal/core"
	"path/filepath"
	"testing"
	"time"
)

func TestDurableBoundedReplay(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "state")
	if err := core.PrivateDir(dir); err != nil {
		t.Fatal(err)
	}
	q, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err = q.Bind(core.UUID(), 1); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	for i := 0; i < 1002; i++ {
		if err = q.Add("CONNECTION_LOST", now); err != nil {
			t.Fatal(err)
		}
	}
	count, dropped := q.Stats()
	if count != 1000 || dropped != 2 {
		t.Fatal(count, dropped)
	}
	first, err := q.Batch(now)
	if err != nil || len(first) != 50 {
		t.Fatal(err, len(first))
	}
	restored, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	again, _ := restored.Batch(now)
	if first[0].EventID != again[0].EventID {
		t.Fatal("retry IDs were regenerated")
	}
	if err := restored.Ack([]string{again[0].EventID}); err != nil {
		t.Fatal(err)
	}
	after, _ := Open(dir)
	count, _ = after.Stats()
	if count != 999 {
		t.Fatal("acknowledgement did not persist")
	}
	if _, err := after.Batch(now.Add(25 * time.Hour)); err != nil {
		t.Fatal(err)
	}
	count, dropped = after.Stats()
	if count != 0 || dropped != 1001 {
		t.Fatal("expired observations survived", count, dropped)
	}
}
func TestGenerationChangeErasesBuffer(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "state")
	core.PrivateDir(dir)
	q, _ := Open(dir)
	id := core.UUID()
	q.Bind(id, 1)
	q.Add("CONNECTION_LOST", time.Now())
	if err := q.Bind(id, 2); err != nil {
		t.Fatal(err)
	}
	again, _ := Open(dir)
	count, _ := again.Stats()
	if count != 0 {
		t.Fatal("old generation survived")
	}
	if err := q.Add("RAW_PROCESS_ARGUMENTS", time.Now()); err == nil {
		t.Fatal("arbitrary diagnostic contents accepted")
	}
}
