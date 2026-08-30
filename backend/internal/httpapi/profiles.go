package httpapi

import (
	"net/http"

	"github.com/S0okJu/mnemo/backend/internal/profile"
)

type profileHandler struct {
	profiles *profile.Manager
}

func (h *profileHandler) list(w http.ResponseWriter, _ *http.Request) {
	profiles, err := h.profiles.List()
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, profiles)
}
