// Package httpapi wires mnemo's data-layer managers (profile, workspace,
// calendar) to a REST API served over net/http.
package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/S0okJu/mnemo/backend/internal/calendar"
	"github.com/S0okJu/mnemo/backend/internal/workspace"
)

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("httpapi: encode response: %v", err)
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

// writeError maps a data-layer error to the appropriate HTTP status code.
func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, workspace.ErrNotFound):
		writeJSONError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, workspace.ErrExists):
		writeJSONError(w, http.StatusConflict, err.Error())
	case errors.Is(err, workspace.ErrInvalidName):
		writeJSONError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, calendar.ErrNotFound):
		writeJSONError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, calendar.ErrInvalidTask), errors.Is(err, calendar.ErrDocumentNotFound):
		writeJSONError(w, http.StatusBadRequest, err.Error())
	default:
		log.Printf("httpapi: internal error: %v", err)
		writeJSONError(w, http.StatusInternalServerError, "internal error")
	}
}
