package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/S0okJu/mnemo/backend/internal/calendar"
)

type calendarHandler struct {
	tasks *calendar.Service
}

type taskRequest struct {
	Title        string     `json:"title"`
	Due          *time.Time `json:"due,omitempty"`
	DocumentName string     `json:"document_name"`
}

type taskUpdateRequest struct {
	Title  *string          `json:"title"`
	Due    *time.Time       `json:"due"`
	Status *calendar.Status `json:"status"`
}

func (h *calendarHandler) list(w http.ResponseWriter, _ *http.Request) {
	tasks, err := h.tasks.List()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (h *calendarHandler) create(w http.ResponseWriter, r *http.Request) {
	var req taskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	task, err := h.tasks.Create(req.Title, req.Due, req.DocumentName)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (h *calendarHandler) update(w http.ResponseWriter, r *http.Request) {
	var req taskUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	task, err := h.tasks.Update(r.PathValue("id"), calendar.UpdateInput{
		Title:  req.Title,
		Due:    req.Due,
		Status: req.Status,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *calendarHandler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.tasks.Delete(r.PathValue("id")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
