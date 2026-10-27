package httpapi

import (
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminAndCSRFGuards(t *testing.T) {
	for _, tt := range []struct {
		name                     string
		logged, admin, tls, csrf bool
		status                   int
	}{
		{"anonymous", false, false, true, true, 401},
		{"reader", true, false, true, true, 403},
		{"http", true, true, false, true, 403},
		{"csrf", true, true, true, false, 403},
	} {
		t.Run(tt.name, func(t *testing.T) {
			a := &API{Identify: func(*http.Request) (Identity, bool) { return Identity{"alice", tt.admin}, tt.logged }, CSRF: func(*http.Request) bool { return tt.csrf }}
			req := httptest.NewRequest("PUT", "/api/v1/cluster/kubeconfig", strings.NewReader(`{}`))
			if tt.tls {
				req.TLS = &tls.ConnectionState{}
			}
			w := httptest.NewRecorder()
			a.Handler().ServeHTTP(w, req)
			if w.Code != tt.status {
				t.Fatalf("got %d want %d", w.Code, tt.status)
			}
			if tt.name == "reader" && !strings.Contains(w.Body.String(), `"reason":"forbidden"`) {
				t.Fatal(w.Body.String())
			}
		})
	}
}
func TestValidationRateLimit(t *testing.T) {
	a := &API{Identify: func(*http.Request) (Identity, bool) { return Identity{"alice", true}, true }, CSRF: func(*http.Request) bool { return true }}
	handler := a.Handler()
	for i := 0; i < 11; i++ {
		req := httptest.NewRequest("POST", "/api/v1/cluster/kubeconfig/validate", strings.NewReader(`{"kubeconfig":"invalid"}`))
		req.TLS = &tls.ConnectionState{}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		want := 200
		if i == 10 {
			want = 429
		}
		if w.Code != want {
			t.Fatalf("request %d got %d want %d", i, w.Code, want)
		}
	}
}
func TestBodyLimit(t *testing.T) {
	req := httptest.NewRequest("PUT", "/", strings.NewReader(`{"kubeconfig":"`+strings.Repeat("x", 1<<20)+`"}`))
	w := httptest.NewRecorder()
	if _, ok := submission(w, req); ok || w.Code != 400 {
		t.Fatalf("oversize accepted: %d", w.Code)
	}
}
