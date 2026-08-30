// Package profile manages mnemo profiles: the fixed, human-owned "user"
// profile plus (in later releases) AI-agent profiles. Each profile owns a
// workspace directory on disk.
package profile

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Kind distinguishes the single human profile from agent profiles.
type Kind string

const (
	KindUser  Kind = "user"
	KindAgent Kind = "agent"
)

// UserProfileName is the name of the sole human-owned profile. It is the
// only profile the v1 API exposes creation/bootstrap for.
const UserProfileName = "user"

// ErrNotFound is returned when a requested profile does not exist.
var ErrNotFound = errors.New("profile: not found")

// Profile is an AI agent's or the user's identity within mnemo, each with
// its own workspace directory.
type Profile struct {
	Name string `json:"name"`
	Kind Kind   `json:"kind"`
}

// Manager resolves profile workspace locations under a data root directory
// laid out as documented in DESIGN.md (profiles/<name>/workspace/*.md).
type Manager struct {
	dataDir string
}

// NewManager returns a Manager rooted at dataDir.
func NewManager(dataDir string) *Manager {
	return &Manager{dataDir: dataDir}
}

// Bootstrap ensures the fixed "user" profile's workspace directory exists.
func (m *Manager) Bootstrap() error {
	if err := os.MkdirAll(m.WorkspaceDir(UserProfileName), 0o755); err != nil {
		return fmt.Errorf("profile: bootstrap %s: %w", UserProfileName, err)
	}
	return nil
}

// WorkspaceDir returns the workspace directory path for the named profile,
// regardless of whether that profile currently exists.
func (m *Manager) WorkspaceDir(name string) string {
	return filepath.Join(m.dataDir, "profiles", name, "workspace")
}

// Get returns the named profile. Only UserProfileName resolves in v1 — there
// is no agent-profile registry yet.
func (m *Manager) Get(name string) (Profile, error) {
	if name != UserProfileName {
		return Profile{}, fmt.Errorf("%w: %s", ErrNotFound, name)
	}
	return Profile{Name: UserProfileName, Kind: KindUser}, nil
}

// List returns all known profiles. In v1 this is always just "user".
func (m *Manager) List() ([]Profile, error) {
	return []Profile{{Name: UserProfileName, Kind: KindUser}}, nil
}
