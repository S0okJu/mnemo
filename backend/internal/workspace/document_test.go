package workspace

import (
	"errors"
	"testing"
)

func TestCreateAndGet(t *testing.T) {
	m := NewManager(t.TempDir())

	created, err := m.Create("notes", "My Notes", "# Hello\n")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if created.Title != "My Notes" || created.Body != "# Hello\n" {
		t.Fatalf("Create() = %+v, unexpected title/body", created)
	}
	if created.CreatedAt.IsZero() || created.UpdatedAt.IsZero() {
		t.Fatalf("Create() = %+v, want non-zero timestamps", created)
	}

	got, err := m.Get("notes")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got != created {
		t.Fatalf("Get() = %+v, want %+v", got, created)
	}
}

func TestCreateDuplicateReturnsErrExists(t *testing.T) {
	m := NewManager(t.TempDir())

	if _, err := m.Create("notes", "My Notes", "body"); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := m.Create("notes", "Again", "body"); !errors.Is(err, ErrExists) {
		t.Fatalf("second Create() error = %v, want ErrExists", err)
	}
}

func TestGetMissingReturnsErrNotFound(t *testing.T) {
	m := NewManager(t.TempDir())

	if _, err := m.Get("missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get() error = %v, want ErrNotFound", err)
	}
}

func TestUpdatePreservesCreatedAt(t *testing.T) {
	m := NewManager(t.TempDir())

	created, err := m.Create("notes", "Title", "body v1")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	updated, err := m.Update("notes", "New Title", "body v2")
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if updated.Title != "New Title" || updated.Body != "body v2" {
		t.Fatalf("Update() = %+v, unexpected title/body", updated)
	}
	if !updated.CreatedAt.Equal(created.CreatedAt) {
		t.Fatalf("Update() CreatedAt = %v, want %v", updated.CreatedAt, created.CreatedAt)
	}
}

func TestUpdateMissingReturnsErrNotFound(t *testing.T) {
	m := NewManager(t.TempDir())

	if _, err := m.Update("missing", "t", "b"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Update() error = %v, want ErrNotFound", err)
	}
}

func TestDelete(t *testing.T) {
	m := NewManager(t.TempDir())

	if _, err := m.Create("notes", "Title", "body"); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := m.Delete("notes"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if _, err := m.Get("notes"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Get() after Delete() error = %v, want ErrNotFound", err)
	}
}

func TestDeleteMissingReturnsErrNotFound(t *testing.T) {
	m := NewManager(t.TempDir())

	if err := m.Delete("missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Delete() error = %v, want ErrNotFound", err)
	}
}

func TestListSortedByName(t *testing.T) {
	m := NewManager(t.TempDir())

	for _, name := range []string{"zeta", "alpha", "mid"} {
		if _, err := m.Create(name, name, "body"); err != nil {
			t.Fatalf("Create(%q) error = %v", name, err)
		}
	}

	docs, err := m.List()
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	want := []string{"alpha", "mid", "zeta"}
	if len(docs) != len(want) {
		t.Fatalf("List() returned %d docs, want %d", len(docs), len(want))
	}
	for i, name := range want {
		if docs[i].Name != name {
			t.Fatalf("List()[%d].Name = %q, want %q", i, docs[i].Name, name)
		}
	}
}

func TestExists(t *testing.T) {
	m := NewManager(t.TempDir())

	if m.Exists("notes") {
		t.Fatalf("Exists() = true before creation, want false")
	}
	if _, err := m.Create("notes", "Title", "body"); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if !m.Exists("notes") {
		t.Fatalf("Exists() = false after creation, want true")
	}
}

func TestSanitizeNameRejectsTraversal(t *testing.T) {
	m := NewManager(t.TempDir())

	for _, name := range []string{"", ".", "..", "../escape", "a/b", "a\\b"} {
		if _, err := m.Create(name, "t", "b"); !errors.Is(err, ErrInvalidName) {
			t.Fatalf("Create(%q) error = %v, want ErrInvalidName", name, err)
		}
	}
}
