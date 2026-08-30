package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/S0okJu/mnemo/backend/internal/workspace"
)

type documentHandler struct {
	docs *workspace.Manager
}

type documentRequest struct {
	Name  string `json:"name"`
	Title string `json:"title"`
	Body  string `json:"body"`
}

func (h *documentHandler) list(w http.ResponseWriter, _ *http.Request) {
	docs, err := h.docs.List()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, docs)
}

func (h *documentHandler) create(w http.ResponseWriter, r *http.Request) {
	var req documentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	doc, err := h.docs.Create(req.Name, req.Title, req.Body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, doc)
}

func (h *documentHandler) get(w http.ResponseWriter, r *http.Request) {
	doc, err := h.docs.Get(r.PathValue("name"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (h *documentHandler) update(w http.ResponseWriter, r *http.Request) {
	var req documentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	doc, err := h.docs.Update(r.PathValue("name"), req.Title, req.Body)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (h *documentHandler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.docs.Delete(r.PathValue("name")); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
