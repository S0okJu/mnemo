package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/S0okJu/mnemo/backend/internal/calendar"
)

func TestCreateTaskRequiresExistingDocument(t *testing.T) {
	srv, _, _ := newTestServerWithCalendar(t)

	resp := doJSON(t, http.MethodPost, srv.URL+"/api/profiles/user/calendar", taskRequest{
		Title: "Write report", DocumentName: "missing-doc",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("POST status = %d, want %d", resp.StatusCode, http.StatusBadRequest)
	}
}

func TestCreateListUpdateDeleteTask(t *testing.T) {
	srv, docs, _ := newTestServerWithCalendar(t)
	if _, err := docs.Create("notes", "Notes", "body"); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	createResp := doJSON(t, http.MethodPost, srv.URL+"/api/profiles/user/calendar", taskRequest{
		Title: "Write report", DocumentName: "notes",
	})
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("POST status = %d, want %d", createResp.StatusCode, http.StatusCreated)
	}
	var created calendar.Task
	if err := json.NewDecoder(createResp.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if created.DocumentName != "notes" || created.Status != calendar.StatusPending {
		t.Fatalf("created = %+v, unexpected fields", created)
	}

	listResp := doJSON(t, http.MethodGet, srv.URL+"/api/profiles/user/calendar", nil)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("GET status = %d, want %d", listResp.StatusCode, http.StatusOK)
	}
	var list []calendar.Task
	if err := json.NewDecoder(listResp.Body).Decode(&list); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("list length = %d, want 1", len(list))
	}

	done := calendar.StatusDone
	updateResp := doJSON(t, http.MethodPatch, srv.URL+"/api/profiles/user/calendar/"+created.ID, taskUpdateRequest{
		Status: &done,
	})
	if updateResp.StatusCode != http.StatusOK {
		t.Fatalf("PATCH status = %d, want %d", updateResp.StatusCode, http.StatusOK)
	}
	var updated calendar.Task
	if err := json.NewDecoder(updateResp.Body).Decode(&updated); err != nil {
		t.Fatalf("decode update response: %v", err)
	}
	if updated.Status != calendar.StatusDone {
		t.Fatalf("updated.Status = %q, want %q", updated.Status, calendar.StatusDone)
	}

	deleteResp := doJSON(t, http.MethodDelete, srv.URL+"/api/profiles/user/calendar/"+created.ID, nil)
	if deleteResp.StatusCode != http.StatusNoContent {
		t.Fatalf("DELETE status = %d, want %d", deleteResp.StatusCode, http.StatusNoContent)
	}
}

func TestUpdateMissingTaskReturns404(t *testing.T) {
	srv, _, _ := newTestServerWithCalendar(t)

	resp := doJSON(t, http.MethodPatch, srv.URL+"/api/profiles/user/calendar/missing", taskUpdateRequest{})
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("PATCH status = %d, want %d", resp.StatusCode, http.StatusNotFound)
	}
}
