package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"mnemo/server/internal/connection"
)

// Identity must be supplied by authenticated session middleware, never from
// untrusted request headers.
type Identity struct {
	User  string
	Admin bool
}
type Identify func(*http.Request) (Identity, bool)
type API struct {
	AllowHTTP               bool
	AllowKubeconfigOverride bool
	Events                  *Events
	Store                   *connection.Store
	Policy                  connection.Policy
	Identify                Identify
	CSRF                    func(*http.Request) bool
	mu                      sync.Mutex
	limits                  map[string]window
}
type window struct {
	start time.Time
	count int
}

func write(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if body != nil {
		_ = json.NewEncoder(w).Encode(body)
	}
}
func (a *API) Handler() http.Handler {
	mux := chi.NewRouter()
	mux.MethodFunc("GET", "/api/v1/cluster/connection", a.get)
	mux.Get("/api/v1/metrics", a.metrics)
	mux.Get("/api/v1/relations", a.relations)
	mux.Get("/api/v1/integrations/kube-ovn/capabilities", a.kubeOVNCapabilities)
	mux.Get("/api/v1/cluster/sync", a.syncHealth)
	mux.MethodFunc("POST", "/api/v1/cluster/kubeconfig/validate", a.validate)
	mux.MethodFunc("PUT", "/api/v1/cluster/kubeconfig", a.replace)
	mux.MethodFunc("POST", "/api/v1/cluster/connection/test", a.test)
	mux.MethodFunc("DELETE", "/api/v1/cluster/kubeconfig", a.disconnect)
	if a.Events != nil {
		mux.Handle("/api/v1/events", a.Events)
	}
	mux.Get("/*", a.resources)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/events" {
			ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
			defer cancel()
			r = r.WithContext(ctx)
		}
		if a.Identify == nil {
			write(w, 401, map[string]string{"message": "Authentication required."})
			return
		}
		identity, ok := a.Identify(r)
		if !ok || identity.User == "" {
			write(w, 401, map[string]string{"message": "Authentication required."})
			return
		}
		if r.Method != http.MethodGet {
			if !identity.Admin {
				write(w, 403, map[string]string{"reason": "forbidden"})
				return
			}
			if r.TLS == nil && !a.AllowHTTP {
				write(w, 403, map[string]string{"message": "HTTPS required."})
				return
			}
			if a.CSRF == nil || !a.CSRF(r) {
				write(w, 403, map[string]string{"message": "Invalid CSRF token."})
				return
			}
		}
		if r.URL.Path == "/api/v1/cluster/kubeconfig/validate" || r.Method == http.MethodPut {
			if !a.allow(identity.User) {
				w.Header().Set("Retry-After", "60")
				write(w, 429, map[string]string{"message": "Validation rate limit exceeded."})
				return
			}
		}
		mux.ServeHTTP(w, r)
	})
}
func (a *API) allow(user string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.limits == nil {
		a.limits = map[string]window{}
	}
	now := time.Now()
	for key, value := range a.limits {
		if now.Sub(value.start) >= time.Minute {
			delete(a.limits, key)
		}
	}
	v := a.limits[user]
	if v.start.IsZero() {
		v.start = now
	}
	v.count++
	a.limits[user] = v
	return v.count <= 10
}
func submission(w http.ResponseWriter, r *http.Request) (connection.Submission, bool) {
	var s connection.Submission
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(&s) != nil || d.Decode(new(any)) != io.EOF {
		write(w, 400, connection.Validation{Checks: []connection.Check{{ID: "yaml", Level: "error", Message: "Use one JSON body no larger than 1 MiB."}}})
		return s, false
	}
	return s, true
}
func (a *API) get(w http.ResponseWriter, r *http.Request) {
	m, _, _, err := a.Store.Load(r.Context())
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	write(w, 200, m)
}
func (a *API) validate(w http.ResponseWriter, r *http.Request) {
	s, ok := submission(w, r)
	if !ok {
		return
	}
	v, _, _, _, _ := connection.Validate(r.Context(), s, a.Policy)
	write(w, 200, v)
}
func (a *API) replace(w http.ResponseWriter, r *http.Request) {
	if !a.AllowKubeconfigOverride {
		m, _, _, err := a.Store.Load(r.Context())
		if err != nil {
			write(w, 503, nil)
			return
		}
		if m.Source == "in-cluster" {
			write(w, 403, map[string]string{"reason": "forbidden"})
			return
		}
	}

	s, ok := submission(w, r)
	if !ok {
		return
	}
	if s.Context == "" {
		write(w, 400, connection.Validation{Checks: []connection.Check{{ID: "contexts", Level: "error", Message: "Select a context."}}})
		return
	}
	v, m, plain, _, status := connection.Validate(r.Context(), s, a.Policy)
	if !v.OK {
		write(w, status, v)
		return
	}
	identity, _ := a.Identify(r)
	if _, err := a.Store.Replace(r.Context(), m, plain, identity.User); err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	write(w, 200, m)
}
func (a *API) test(w http.ResponseWriter, r *http.Request) {
	m, plain, generation, err := a.Store.Load(r.Context())
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	if !m.Configured {
		write(w, 200, m)
		return
	}
	if m.Source == "in-cluster" {
		updated, e := connection.ProbeInCluster(r.Context(), a.Policy)
		if e != nil {
			write(w, 503, nil)
			return
		}
		if a.Store.UpdateStatus(r.Context(), generation, updated) != nil {
			write(w, 503, nil)
			return
		}
		write(w, 200, updated)
		return
	}
	_, updated, _, _, _ := connection.Validate(r.Context(), connection.Submission{Kubeconfig: string(plain), Context: m.Context, Namespace: m.Namespace}, a.Policy)
	if updated.Context == "" {
		updated = m
		updated.Status = "unreachable"
		updated.Message = "Stored connection failed validation."
		updated.CheckedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if err = a.Store.UpdateStatus(r.Context(), generation, updated); err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	write(w, 200, updated)
}
func (a *API) disconnect(w http.ResponseWriter, r *http.Request) {
	m, _, _, err := a.Store.Load(r.Context())
	if err != nil {
		write(w, 503, nil)
		return
	}
	if m.Source == "in-cluster" {
		write(w, 403, map[string]string{"reason": "forbidden"})
		return
	}

	identity, _ := a.Identify(r)
	_, err = a.Store.Replace(r.Context(), connection.Metadata{Source: "kubeconfig", Status: "not-configured"}, nil, identity.User)
	if err != nil {
		write(w, 503, map[string]string{"message": "Database unavailable."})
		return
	}
	write(w, 204, nil)
}
