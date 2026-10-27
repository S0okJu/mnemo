package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHTTPModeRequiresExplicitOptInAndRetainsRolesAndCSRF(t *testing.T) {
	const adminPassword = "test-admin-password-long-enough"
	const viewerPassword = "test-viewer-password-long-enough"
	identify := BasicIdentity(adminPassword, viewerPassword)
	request := httptest.NewRequest("GET", "http://mnemo.test/api/v1/session", nil)
	request.SetBasicAuth("admin", adminPassword)
	session := httptest.NewRecorder()
	SessionWithIdentity(identify)(session, request)
	if session.Code != 200 {
		t.Fatal(session.Code)
	}
	cookies := session.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != "mnemo-csrf" || cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatal("invalid lab HTTP cookie")
	}
	var body struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.Unmarshal(session.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	for _, tt := range []struct {
		name, user, password string
		enabled, csrf        bool
		status               int
	}{
		{"disabled", "admin", adminPassword, false, true, 403},
		{"missing-csrf", "admin", adminPassword, true, false, 403},
		{"viewer", "viewer", viewerPassword, true, true, 403},
		{"invalid-password", "admin", "wrong", true, true, 401},
		{"enabled", "admin", adminPassword, true, true, 200},
	} {
		t.Run(tt.name, func(t *testing.T) {
			api := &API{AllowHTTP: tt.enabled, Identify: identify, CSRF: CheckCSRF}
			r := httptest.NewRequest("POST", "http://mnemo.test/api/v1/cluster/kubeconfig/validate", strings.NewReader(`{"kubeconfig":"invalid"}`))
			r.SetBasicAuth(tt.user, tt.password)
			if tt.csrf {
				r.AddCookie(cookies[0])
				r.Header.Set("X-CSRF-Token", body.CSRFToken)
			}
			w := httptest.NewRecorder()
			api.Handler().ServeHTTP(w, r)
			if w.Code != tt.status {
				t.Fatalf("got %d want %d", w.Code, tt.status)
			}
		})
	}
	if _, ok := BasicIdentity("short", "short")(request); ok {
		t.Fatal("weak lab credentials accepted")
	}
}
