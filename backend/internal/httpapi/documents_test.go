package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/S0okJu/mnemo/backend/internal/profile"
	"github.com/S0okJu/mnemo/backend/internal/workspace"
)

func newTestServer(t *testing.T) (*httptest.Server, *workspace.Manager) {
	t.Helper()
	dataDir := t.TempDir()
	profiles := profile.NewManager(dataDir)
	if err := profiles.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap() error = %v", err)
	}
	docs := workspace.NewManager(profiles.WorkspaceDir(profile.UserProfileName))

	srv := httptest.NewServer(NewRouter(profiles, docs))
	t.Cleanup(srv.Close)
	return srv, docs
}

func doJSON(t *testing.T, method, url string, body any) *http.Response {
	t.Helper()
	var reader bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reader = *bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, url, &reader)
	if err != nil {
		t.Fatalf("NewRequest(%s %s): %v", method, url, err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do(%s %s): %v", method, url, err)
	}
	t.Cleanup(func() { resp.Body.Close() })
	return resp
}

func TestCreateGetUpdateDeleteDocument(t *testing.T) {
	srv, _ := newTestServer(t)

	createResp := doJSON(t, http.MethodPost, srv.URL+"/api/profiles/user/documents", documentRequest{
		Name: "notes", Title: "My Notes", Body: "# Hello\n",
	})
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("POST status = %d, want %d", createResp.StatusCode, http.StatusCreated)
	}
	var created workspace.Document
	if err := json.NewDecoder(createResp.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if created.Title != "My Notes" {
		t.Fatalf("created.Title = %q, want %q", created.Title, "My Notes")
	}

	getResp := doJSON(t, http.MethodGet, srv.URL+"/api/profiles/user/documents/notes", nil)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("GET status = %d, want %d", getResp.StatusCode, http.StatusOK)
	}

	updateResp := doJSON(t, http.MethodPut, srv.URL+"/api/profiles/user/documents/notes", documentRequest{
		Title: "Updated", Body: "new body",
	})
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("PUT status = %d, want %d", updateResp.StatusCode, http.StatusOK)
	}
	var updated workspace.Document
	if err := json.NewDecoder(updateResp.Body).Decode(&updated); err != nil {
		t.Fatalf("decode update response: %v", err)
	}
	if updated.Title != "Updated" || updated.Body != "new body" {
		t.Fatalf("updated = %+v, unexpected title/body", updated)
	}

	deleteResp := doJSON(t, http.MethodDelete, srv.URL+"/api/profiles/user/documents/notes", nil)
	if deleteResp.StatusCode != http.StatusNoContent {
		t.Fatalf("DELETE status = %d, want %d", deleteResp.StatusCode, http.StatusNoContent)
	}

	getAfterDelete := doJSON(t, http.MethodGet, srv.URL+"/api/profiles/user/documents/notes", nil)
	if getAfterDelete.StatusCode != http.StatusNotFound {
		t.Fatalf("GET after delete status = %d, want %d", getAfterDelete.StatusCode, http.StatusNotFound)
	}
}

func TestCreateDuplicateReturns409(t *testing.T) {
	srv, _ := newTestServer(t)

	req := documentRequest{Name: "notes", Title: "T", Body: "b"}
	first := doJSON(t, http.MethodPost, srv.URL+"/api/profiles/user/documents", req)
	if first.StatusCode != http.StatusCreated {
		t.Fatalf("first POST status = %d, want %d", first.StatusCode, http.StatusCreated)
	}

	second := doJSON(t, http.MethodPost, srv.URL+"/api/profiles/user/documents", req)
	if second.StatusCode != http.StatusConflict {
		t.Fatalf("second POST status = %d, want %d", second.StatusCode, http.StatusConflict)
	}
}

func TestCreateInvalidNameReturns400(t *testing.T) {
	srv, _ := newTestServer(t)

	resp := doJSON(t, http.MethodPost, srv.URL+"/api/profiles/user/documents", documentRequest{
		Name: "../escape", Title: "T", Body: "b",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("POST status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestCreateInvalidJSONReturns400(t *testing.T) {
	srv, _ := newTestServer(t)

	req, err := http.NewRequest(http.MethodPost, srv.URL+"/api/profiles/user/documents", bytes.NewBufferString("not json"))
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Do: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("POST status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestListDocuments(t *testing.T) {
	srv, docs := newTestServer(t)

	for _, name := range []string{"a", "b"} {
		if _, err := docs.Create(name, name, "body"); err != nil {
			t.Fatalf("Create(%q) error = %v", name, err)
		}
	}

	resp := doJSON(t, http.MethodGet, srv.URL+"/api/profiles/user/documents", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var list []workspace.Document
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("list length = %d, want 2", len(list))
	}
}

func TestGetMissingDocumentReturns404(t *testing.T) {
	srv, _ := newTestServer(t)

	resp := doJSON(t, http.MethodGet, srv.URL+"/api/profiles/user/documents/missing", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("GET status = %d, want %d", resp.StatusCode, http.StatusNotFound)
	}
}

func TestListProfiles(t *testing.T) {
	srv, _ := newTestServer(t)

	resp := doJSON(t, http.MethodGet, srv.URL+"/api/profiles", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	var list []profile.Profile
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		t.Fatalf("decode profiles response: %v", err)
	}
	if len(list) != 1 || list[0].Name != profile.UserProfileName {
		t.Fatalf("profiles = %+v, want single %q profile", list, profile.UserProfileName)
	}
}
