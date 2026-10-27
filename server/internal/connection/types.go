package connection

import "time"

type Check struct {
	ID      string `json:"id"`
	Level   string `json:"level"`
	Message string `json:"message"`
}
type Submission struct {
	Kubeconfig string `json:"kubeconfig"`
	Context    string `json:"context,omitempty"`
	Namespace  string `json:"namespace,omitempty"`
}
type Metadata struct {
	Configured bool   `json:"configured"`
	Source     string `json:"source"`
	Context    string `json:"context,omitempty"`
	Cluster    string `json:"cluster,omitempty"`
	Server     string `json:"server,omitempty"`
	User       string `json:"user,omitempty"`
	AuthType   string `json:"authType,omitempty"`
	Namespace  string `json:"namespace,omitempty"`
	Version    string `json:"version,omitempty"`
	Status     string `json:"status"`
	Message    string `json:"message,omitempty"`
	CheckedAt  string `json:"checkedAt,omitempty"`
}
type Validation struct {
	OK      bool    `json:"ok"`
	Version string  `json:"version,omitempty"`
	Checks  []Check `json:"checks"`
}
type Policy struct {
	RequireTLSVerify bool
	AllowExec        bool
	ExecAllowlist    []string
	ExecEnvAllowlist []string
	ExecTimeout      time.Duration
}
