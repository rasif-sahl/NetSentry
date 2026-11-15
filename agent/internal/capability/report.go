package capability

// Report is the initial language-neutral capability contract, not monitoring data.
type Report struct {
	SchemaVersion int      `json:"schemaVersion"`
	Modules       []Module `json:"modules"`
}

type Module struct {
	ID      string `json:"id"`
	Enabled bool   `json:"enabled"`
	Status  string `json:"status"`
	Reason  string `json:"reason"`
}
