// Package calendar manages a profile's calendar: a list of tasks, each of
// which must link to an existing workspace document.
package calendar

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/S0okJu/mnemo/backend/internal/fsutil"
)

// Status is a task's lifecycle state.
type Status string

const (
	StatusPending Status = "pending"
	StatusDone    Status = "done"
)

var (
	// ErrNotFound is returned when a requested task does not exist.
	ErrNotFound = errors.New("calendar: task not found")
	// ErrInvalidTask is returned when a task is missing a required field.
	ErrInvalidTask = errors.New("calendar: invalid task")
	// ErrDocumentNotFound is returned when a task references a document
	// that does not exist in the profile's workspace.
	ErrDocumentNotFound = errors.New("calendar: linked document not found")
)

// Task is a calendar entry linked to exactly one workspace document.
type Task struct {
	ID           string     `json:"id"`
	Title        string     `json:"title"`
	Due          *time.Time `json:"due,omitempty"`
	DocumentName string     `json:"document_name"`
	Status       Status     `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
}

// DocumentChecker reports whether a named document exists in a profile's
// workspace. workspace.Manager satisfies this.
type DocumentChecker interface {
	Exists(name string) bool
}

// Service manages tasks stored as a JSON array at a single file path.
type Service struct {
	path string
	docs DocumentChecker

	mu sync.Mutex
}

// NewService returns a Service backed by the JSON file at path, validating
// task-document links against docs.
func NewService(path string, docs DocumentChecker) *Service {
	return &Service{path: path, docs: docs}
}

// UpdateInput carries the fields a PATCH may change; nil fields are left
// unchanged.
type UpdateInput struct {
	Title  *string
	Due    *time.Time
	Status *Status
}

// Create registers a new task. DocumentName must reference an existing
// document, or ErrDocumentNotFound is returned.
func (s *Service) Create(title string, due *time.Time, documentName string) (Task, error) {
	if title == "" {
		return Task{}, fmt.Errorf("%w: title is required", ErrInvalidTask)
	}
	if documentName == "" {
		return Task{}, fmt.Errorf("%w: document_name is required", ErrInvalidTask)
	}
	if !s.docs.Exists(documentName) {
		return Task{}, fmt.Errorf("%w: %s", ErrDocumentNotFound, documentName)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	tasks, err := s.load()
	if err != nil {
		return Task{}, err
	}
	id, err := newID()
	if err != nil {
		return Task{}, err
	}

	task := Task{
		ID:           id,
		Title:        title,
		Due:          due,
		DocumentName: documentName,
		Status:       StatusPending,
		CreatedAt:    time.Now().UTC(),
	}
	tasks = append(tasks, task)
	if err := s.save(tasks); err != nil {
		return Task{}, err
	}
	return task, nil
}

// List returns every task, in the order they were created.
func (s *Service) List() ([]Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load()
}

// Update applies in to the task with the given id.
func (s *Service) Update(id string, in UpdateInput) (Task, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	tasks, err := s.load()
	if err != nil {
		return Task{}, err
	}

	idx := indexOf(tasks, id)
	if idx == -1 {
		return Task{}, fmt.Errorf("%w: %s", ErrNotFound, id)
	}

	if in.Title != nil {
		tasks[idx].Title = *in.Title
	}
	if in.Due != nil {
		tasks[idx].Due = in.Due
	}
	if in.Status != nil {
		tasks[idx].Status = *in.Status
	}

	if err := s.save(tasks); err != nil {
		return Task{}, err
	}
	return tasks[idx], nil
}

// Delete removes the task with the given id.
func (s *Service) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tasks, err := s.load()
	if err != nil {
		return err
	}

	idx := indexOf(tasks, id)
	if idx == -1 {
		return fmt.Errorf("%w: %s", ErrNotFound, id)
	}

	tasks = append(tasks[:idx], tasks[idx+1:]...)
	return s.save(tasks)
}

func indexOf(tasks []Task, id string) int {
	for i, t := range tasks {
		if t.ID == id {
			return i
		}
	}
	return -1
}

func newID() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("calendar: generate id: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

func (s *Service) load() ([]Task, error) {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return []Task{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("calendar: read %s: %w", s.path, err)
	}
	if len(data) == 0 {
		return []Task{}, nil
	}

	var tasks []Task
	if err := json.Unmarshal(data, &tasks); err != nil {
		return nil, fmt.Errorf("calendar: parse %s: %w", s.path, err)
	}
	return tasks, nil
}

func (s *Service) save(tasks []Task) error {
	data, err := json.MarshalIndent(tasks, "", "  ")
	if err != nil {
		return fmt.Errorf("calendar: encode: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return fmt.Errorf("calendar: mkdir %s: %w", filepath.Dir(s.path), err)
	}
	if err := fsutil.AtomicWriteFile(s.path, data, 0o644); err != nil {
		return fmt.Errorf("calendar: write %s: %w", s.path, err)
	}
	return nil
}
