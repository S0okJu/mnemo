package httpapi

import (
	"net/http"

	"github.com/S0okJu/mnemo/backend/internal/profile"
	"github.com/S0okJu/mnemo/backend/internal/workspace"
)

// NewRouter builds the mnemo REST API mux for the "user" profile's documents
// (and, in later sub-tasks, its calendar).
func NewRouter(profiles *profile.Manager, docs *workspace.Manager) *http.ServeMux {
	mux := http.NewServeMux()

	p := &profileHandler{profiles: profiles}
	d := &documentHandler{docs: docs}

	mux.HandleFunc("GET /api/profiles", p.list)

	mux.HandleFunc("GET /api/profiles/user/documents", d.list)
	mux.HandleFunc("POST /api/profiles/user/documents", d.create)
	mux.HandleFunc("GET /api/profiles/user/documents/{name}", d.get)
	mux.HandleFunc("PUT /api/profiles/user/documents/{name}", d.update)
	mux.HandleFunc("DELETE /api/profiles/user/documents/{name}", d.delete)

	return mux
}
