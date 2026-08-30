package httpapi

import (
	"net/http"

	"github.com/S0okJu/mnemo/backend/internal/calendar"
	"github.com/S0okJu/mnemo/backend/internal/profile"
	"github.com/S0okJu/mnemo/backend/internal/workspace"
)

// NewRouter builds the mnemo REST API mux for the "user" profile's documents
// and calendar.
func NewRouter(profiles *profile.Manager, docs *workspace.Manager, tasks *calendar.Service) *http.ServeMux {
	mux := http.NewServeMux()

	p := &profileHandler{profiles: profiles}
	d := &documentHandler{docs: docs}
	c := &calendarHandler{tasks: tasks}

	mux.HandleFunc("GET /api/profiles", p.list)

	mux.HandleFunc("GET /api/profiles/user/documents", d.list)
	mux.HandleFunc("POST /api/profiles/user/documents", d.create)
	mux.HandleFunc("GET /api/profiles/user/documents/{name}", d.get)
	mux.HandleFunc("PUT /api/profiles/user/documents/{name}", d.update)
	mux.HandleFunc("DELETE /api/profiles/user/documents/{name}", d.delete)

	mux.HandleFunc("GET /api/profiles/user/calendar", c.list)
	mux.HandleFunc("POST /api/profiles/user/calendar", c.create)
	mux.HandleFunc("PATCH /api/profiles/user/calendar/{id}", c.update)
	mux.HandleFunc("DELETE /api/profiles/user/calendar/{id}", c.delete)

	return mux
}
