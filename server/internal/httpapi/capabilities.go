package httpapi

import (
	"net/http"

	"mnemo/server/internal/collection"
)

func (a *API) kubeOVNCapabilities(w http.ResponseWriter, r *http.Request) {
	metadata, _, generation, err := a.Store.Load(r.Context())
	if err != nil {
		write(w, 503, nil)
		return
	}
	if !metadata.Configured {
		write(w, 409, map[string]string{"reason": "not-configured"})
		return
	}
	rows, err := a.Store.Pool.Query(r.Context(), "SELECT kind,initialized,error FROM sync_states WHERE connection_id=1 AND generation=$1", generation)
	if err != nil {
		write(w, 503, nil)
		return
	}
	type state struct {
		initialized bool
		problem     *string
	}
	states := map[string]state{}
	for rows.Next() {
		var name string
		var value state
		if err = rows.Scan(&name, &value.initialized, &value.problem); err != nil {
			rows.Close()
			write(w, 503, nil)
			return
		}
		states[name] = value
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		write(w, 503, nil)
		return
	}
	resources := []any{}
	installed := false
	for _, kind := range collection.Kinds {
		if kind.GVR.Group != "kubeovn.io" {
			continue
		}
		value, found := states[kind.Name]
		if !found || value.problem != nil && *value.problem != "forbidden" && *value.problem != "missing-crd" || !value.initialized && value.problem == nil {
			// Unknown startup/outage state cannot truthfully be reported as absent.
			write(w, 503, map[string]string{"message": "Cluster capability discovery is unavailable or initializing."})
			return
		}
		available := value.initialized || value.problem != nil && *value.problem == "forbidden"
		permitted := value.initialized && value.problem == nil
		if available {
			installed = true
		}
		resources = append(resources, map[string]any{"kind": collection.UIKind(kind.Name), "available": available, "permitted": permitted})
	}
	write(w, 200, map[string]any{"installed": installed, "source": "cluster", "resources": resources})
}
