package profile

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestBootstrapCreatesUserWorkspace(t *testing.T) {
	dir := t.TempDir()
	m := NewManager(dir)

	if err := m.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap() error = %v", err)
	}

	want := filepath.Join(dir, "profiles", UserProfileName, "workspace")
	info, err := os.Stat(want)
	if err != nil {
		t.Fatalf("expected workspace dir at %s: %v", want, err)
	}
	if !info.IsDir() {
		t.Fatalf("%s exists but is not a directory", want)
	}
}

func TestGetUserProfile(t *testing.T) {
	m := NewManager(t.TempDir())

	p, err := m.Get(UserProfileName)
	if err != nil {
		t.Fatalf("Get(%q) error = %v", UserProfileName, err)
	}
	if p.Name != UserProfileName || p.Kind != KindUser {
		t.Fatalf("Get(%q) = %+v, want Name=%q Kind=%q", UserProfileName, p, UserProfileName, KindUser)
	}
}

func TestGetUnknownProfileReturnsNotFound(t *testing.T) {
	m := NewManager(t.TempDir())

	_, err := m.Get("hermes")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get(%q) error = %v, want ErrNotFound", "hermes", err)
	}
}

func TestListReturnsUserProfile(t *testing.T) {
	m := NewManager(t.TempDir())

	profiles, err := m.List()
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(profiles) != 1 || profiles[0].Name != UserProfileName {
		t.Fatalf("List() = %+v, want single %q profile", profiles, UserProfileName)
	}
}
