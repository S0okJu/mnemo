// Package workspace manages CRUD of markdown documents inside a single
// profile's workspace directory. Each document is a .md file with a YAML
// frontmatter block (title, created_at, updated_at) followed by its body.
package workspace

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/S0okJu/mnemo/backend/internal/fsutil"
	"gopkg.in/yaml.v3"
)

const frontmatterDelim = "---\n"

var (
	// ErrNotFound is returned when a requested document does not exist.
	ErrNotFound = errors.New("workspace: document not found")
	// ErrExists is returned by Create when a document with the same name
	// already exists.
	ErrExists = errors.New("workspace: document already exists")
	// ErrInvalidName is returned when a document name is empty or would
	// resolve outside the workspace directory.
	ErrInvalidName = errors.New("workspace: invalid document name")
)

// Document is a markdown file plus its frontmatter metadata.
type Document struct {
	Name      string    `json:"name"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type frontmatter struct {
	Title     string    `yaml:"title"`
	CreatedAt time.Time `yaml:"created_at"`
	UpdatedAt time.Time `yaml:"updated_at"`
}

// Manager performs CRUD on markdown documents under a single directory.
type Manager struct {
	dir string
}

// NewManager returns a Manager rooted at dir, which must be a profile's
// workspace directory.
func NewManager(dir string) *Manager {
	return &Manager{dir: dir}
}

// sanitizeName rejects names that are empty or would let a path escape dir
// (e.g. via "..", "/", or an embedded separator).
func sanitizeName(name string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("%w: empty name", ErrInvalidName)
	}
	if name == "." || name == ".." {
		return "", fmt.Errorf("%w: %q is not allowed", ErrInvalidName, name)
	}
	if strings.ContainsAny(name, "/\\") || filepath.Base(name) != name {
		return "", fmt.Errorf("%w: %q must not contain path separators", ErrInvalidName, name)
	}
	return name, nil
}

func (m *Manager) path(name string) (string, error) {
	safe, err := sanitizeName(name)
	if err != nil {
		return "", err
	}
	return filepath.Join(m.dir, safe+".md"), nil
}

// Exists reports whether a document with the given name exists. It is used
// by the calendar service to validate task-document links.
func (m *Manager) Exists(name string) bool {
	path, err := m.path(name)
	if err != nil {
		return false
	}
	_, err = os.Stat(path)
	return err == nil
}

// Create writes a new document. It returns ErrExists if name is already
// taken and ErrInvalidName if name is unsafe.
func (m *Manager) Create(name, title, body string) (Document, error) {
	path, err := m.path(name)
	if err != nil {
		return Document{}, err
	}
	if _, err := os.Stat(path); err == nil {
		return Document{}, fmt.Errorf("%w: %s", ErrExists, name)
	} else if !errors.Is(err, os.ErrNotExist) {
		return Document{}, fmt.Errorf("workspace: stat %s: %w", name, err)
	}

	now := time.Now().UTC()
	fm := frontmatter{Title: title, CreatedAt: now, UpdatedAt: now}
	if err := writeDocument(path, fm, body); err != nil {
		return Document{}, fmt.Errorf("workspace: create %s: %w", name, err)
	}
	return Document{Name: name, Title: title, Body: body, CreatedAt: now, UpdatedAt: now}, nil
}

// Get reads a document by name.
func (m *Manager) Get(name string) (Document, error) {
	path, err := m.path(name)
	if err != nil {
		return Document{}, err
	}
	fm, body, err := readDocument(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Document{}, fmt.Errorf("%w: %s", ErrNotFound, name)
		}
		return Document{}, err
	}
	return Document{Name: name, Title: fm.Title, Body: body, CreatedAt: fm.CreatedAt, UpdatedAt: fm.UpdatedAt}, nil
}

// Update replaces a document's title and body, preserving its original
// created_at and bumping updated_at. It returns ErrNotFound if name doesn't
// exist yet.
func (m *Manager) Update(name, title, body string) (Document, error) {
	existing, err := m.Get(name)
	if err != nil {
		return Document{}, err
	}
	path, err := m.path(name)
	if err != nil {
		return Document{}, err
	}

	now := time.Now().UTC()
	fm := frontmatter{Title: title, CreatedAt: existing.CreatedAt, UpdatedAt: now}
	if err := writeDocument(path, fm, body); err != nil {
		return Document{}, fmt.Errorf("workspace: update %s: %w", name, err)
	}
	return Document{Name: name, Title: title, Body: body, CreatedAt: existing.CreatedAt, UpdatedAt: now}, nil
}

// Delete removes a document. It returns ErrNotFound if name doesn't exist.
func (m *Manager) Delete(name string) error {
	path, err := m.path(name)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("%w: %s", ErrNotFound, name)
		}
		return fmt.Errorf("workspace: delete %s: %w", name, err)
	}
	return nil
}

// List returns every document in the workspace, sorted by name.
func (m *Manager) List() ([]Document, error) {
	entries, err := os.ReadDir(m.dir)
	if err != nil {
		return nil, fmt.Errorf("workspace: list %s: %w", m.dir, err)
	}

	docs := make([]Document, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		name := strings.TrimSuffix(entry.Name(), ".md")
		doc, err := m.Get(name)
		if err != nil {
			return nil, err
		}
		docs = append(docs, doc)
	}
	sort.Slice(docs, func(i, j int) bool { return docs[i].Name < docs[j].Name })
	return docs, nil
}

func writeDocument(path string, fm frontmatter, body string) error {
	meta, err := yaml.Marshal(fm)
	if err != nil {
		return fmt.Errorf("workspace: marshal frontmatter: %w", err)
	}

	var buf bytes.Buffer
	buf.WriteString(frontmatterDelim)
	buf.Write(meta)
	buf.WriteString(frontmatterDelim)
	buf.WriteString(body)

	return fsutil.AtomicWriteFile(path, buf.Bytes(), 0o644)
}

func readDocument(path string) (frontmatter, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return frontmatter{}, "", err
	}
	if !bytes.HasPrefix(data, []byte(frontmatterDelim)) {
		return frontmatter{}, "", fmt.Errorf("workspace: %s: missing frontmatter", path)
	}

	rest := data[len(frontmatterDelim):]
	end := bytes.Index(rest, []byte(frontmatterDelim))
	if end == -1 {
		return frontmatter{}, "", fmt.Errorf("workspace: %s: unterminated frontmatter", path)
	}

	var fm frontmatter
	if err := yaml.Unmarshal(rest[:end], &fm); err != nil {
		return frontmatter{}, "", fmt.Errorf("workspace: %s: parse frontmatter: %w", path, err)
	}

	body := strings.TrimPrefix(string(rest[end+len(frontmatterDelim):]), "\n")
	return fm, body, nil
}
