package calendar

import (
	"errors"
	"path/filepath"
	"testing"
)

type fakeDocs struct {
	existing map[string]bool
}

func (f fakeDocs) Exists(name string) bool { return f.existing[name] }

func newTestService(t *testing.T, docs map[string]bool) *Service {
	t.Helper()
	path := filepath.Join(t.TempDir(), "user.json")
	return NewService(path, fakeDocs{existing: docs})
}

func TestCreateRequiresExistingDocument(t *testing.T) {
	s := newTestService(t, map[string]bool{"notes": true})

	if _, err := s.Create("Write report", nil, "missing-doc"); !errors.Is(err, ErrDocumentNotFound) {
		t.Fatalf("Create() error = %v, want ErrDocumentNotFound", err)
	}

	task, err := s.Create("Write report", nil, "notes")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if task.DocumentName != "notes" || task.Status != StatusPending {
		t.Fatalf("Create() = %+v, unexpected fields", task)
	}
	if task.ID == "" {
		t.Fatalf("Create() = %+v, want non-empty ID", task)
	}
}

func TestCreateRequiresTitleAndDocumentName(t *testing.T) {
	s := newTestService(t, map[string]bool{"notes": true})

	if _, err := s.Create("", nil, "notes"); !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("Create() with empty title error = %v, want ErrInvalidTask", err)
	}
	if _, err := s.Create("Title", nil, ""); !errors.Is(err, ErrInvalidTask) {
		t.Fatalf("Create() with empty document_name error = %v, want ErrInvalidTask", err)
	}
}

func TestListReturnsCreatedTasks(t *testing.T) {
	s := newTestService(t, map[string]bool{"notes": true})

	if _, err := s.Create("Task 1", nil, "notes"); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := s.Create("Task 2", nil, "notes"); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	tasks, err := s.List()
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(tasks) != 2 {
		t.Fatalf("List() returned %d tasks, want 2", len(tasks))
	}
}

func TestUpdateStatus(t *testing.T) {
	s := newTestService(t, map[string]bool{"notes": true})

	task, err := s.Create("Task", nil, "notes")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	done := StatusDone
	updated, err := s.Update(task.ID, UpdateInput{Status: &done})
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if updated.Status != StatusDone {
		t.Fatalf("Update() Status = %q, want %q", updated.Status, StatusDone)
	}
}

func TestUpdateMissingReturnsErrNotFound(t *testing.T) {
	s := newTestService(t, map[string]bool{"notes": true})

	if _, err := s.Update("missing", UpdateInput{}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Update() error = %v, want ErrNotFound", err)
	}
}

func TestDelete(t *testing.T) {
	s := newTestService(t, map[string]bool{"notes": true})

	task, err := s.Create("Task", nil, "notes")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := s.Delete(task.ID); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}

	tasks, err := s.List()
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(tasks) != 0 {
		t.Fatalf("List() after delete = %+v, want empty", tasks)
	}
}

func TestDeleteMissingReturnsErrNotFound(t *testing.T) {
	s := newTestService(t, map[string]bool{"notes": true})

	if err := s.Delete("missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("Delete() error = %v, want ErrNotFound", err)
	}
}
