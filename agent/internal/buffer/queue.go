package buffer

import (
	"encoding/json"
	"errors"
	"netsentry.local/agent/internal/core"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const MaxEvents = 1000
const MaxBytes = 1048576
const MaxAge = 24 * time.Hour

type Event struct {
	EventID    string `json:"eventId"`
	Kind       string `json:"kind"`
	Code       string `json:"code"`
	OccurredAt string `json:"occurredAt"`
}
type state struct {
	SchemaVersion int     `json:"schemaVersion"`
	AgentID       string  `json:"agentId"`
	Generation    int     `json:"generation"`
	Dropped       int     `json:"dropped"`
	Events        []Event `json:"events"`
}
type Queue struct {
	mu    sync.Mutex
	path  string
	value state
}

var codes = map[string]bool{"CONNECTION_LOST": true, "CONNECTION_RESTORED": true, "BUFFER_DROPPED": true, "CONFIG_CHANGED": true, "MODULE_DISABLED": true, "INVALID_BATCH": true}

func Open(dir string) (*Queue, error) {
	queue := &Queue{path: filepath.Join(dir, "outbox.json"), value: state{SchemaVersion: 1, Events: []Event{}}}
	err := core.ReadPrivate(queue.path, MaxBytes, &queue.value)
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	if queue.value.SchemaVersion != 1 || len(queue.value.Events) > MaxEvents || queue.value.Dropped < 0 {
		return nil, errors.New("unsupported or oversized outbox")
	}
	for _, e := range queue.value.Events {
		if !codes[e.Code] || e.Kind != "diagnostic" || !core.ValidUUID(e.EventID) {
			return nil, errors.New("invalid diagnostic outbox")
		}
		if _, err := time.Parse(core.TimeLayout, e.OccurredAt); err != nil {
			return nil, errors.New("invalid diagnostic time")
		}
	}
	return queue, nil
}
func (q *Queue) persist() error { return core.WritePrivate(q.path, q.value) }
func (q *Queue) Bind(id string, generation int) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if id != q.value.AgentID || generation != q.value.Generation {
		q.value = state{SchemaVersion: 1, AgentID: id, Generation: generation, Events: []Event{}}
		return q.persist()
	}
	return nil
}
func (q *Queue) Add(code string, now time.Time) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	if !codes[code] {
		return errors.New("unsupported diagnostic code")
	}
	q.prune(now)
	q.value.Events = append(q.value.Events, Event{EventID: core.UUID(), Kind: "diagnostic", Code: code, OccurredAt: core.Timestamp(now)})
	for {
		data, err := json.Marshal(q.value)
		if err != nil {
			return err
		}
		if len(q.value.Events) <= MaxEvents && len(data) <= MaxBytes {
			break
		}
		q.value.Events = q.value.Events[1:]
		if q.value.Dropped < 2147483647 {
			q.value.Dropped++
		}
	}
	return q.persist()
}
func (q *Queue) prune(now time.Time) {
	kept := make([]Event, 0, len(q.value.Events))
	for _, event := range q.value.Events {
		at, err := time.Parse(core.TimeLayout, event.OccurredAt)
		if err != nil || at.Before(now.Add(-MaxAge)) || at.After(now.Add(5*time.Minute)) {
			if q.value.Dropped < 2147483647 {
				q.value.Dropped++
			}
			continue
		}
		kept = append(kept, event)
	}
	q.value.Events = kept
}
func (q *Queue) Batch(now time.Time) ([]Event, error) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.prune(now)
	if err := q.persist(); err != nil {
		return nil, err
	}
	limit := len(q.value.Events)
	if limit > 50 {
		limit = 50
	}
	return append([]Event(nil), q.value.Events[:limit]...), nil
}
func (q *Queue) Ack(ids []string) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	seen := map[string]bool{}
	for _, id := range ids {
		seen[id] = true
	}
	kept := []Event{}
	for _, e := range q.value.Events {
		if !seen[e.EventID] {
			kept = append(kept, e)
		}
	}
	q.value.Events = kept
	return q.persist()
}
func (q *Queue) Clear() error { return q.Bind("", 0) }
func (q *Queue) Stats() (int, int) {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.value.Events), q.value.Dropped
}
