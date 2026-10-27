package httpapi

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
)

// CertificateIdentity uses only certificates verified by the TLS listener.
// The client CA is an administration trust root: issuing an OU=mnemo-admin
// certificate grants connection administration.
func CertificateIdentity(r *http.Request) (Identity, bool) {
	if r.TLS == nil || len(r.TLS.VerifiedChains) == 0 || len(r.TLS.VerifiedChains[0]) == 0 {
		return Identity{}, false
	}
	cert := r.TLS.VerifiedChains[0][0]
	if cert.Subject.CommonName == "" {
		return Identity{}, false
	}
	identity := Identity{User: cert.Subject.CommonName}
	for _, ou := range cert.Subject.OrganizationalUnit {
		if ou == "mnemo-admin" {
			identity.Admin = true
		}
	}
	return identity, true
}
func CheckCSRF(r *http.Request) bool {
	cookie, err := r.Cookie(csrfCookieName(r))
	if err != nil {
		return false
	}
	token := r.Header.Get("X-CSRF-Token")
	return len(token) == 43 && len(cookie.Value) == 43 && subtle.ConstantTimeCompare([]byte(token), []byte(cookie.Value)) == 1
}
func Session(w http.ResponseWriter, r *http.Request) {
	SessionWithIdentity(CertificateIdentity)(w, r)
}
func SessionWithIdentity(identify Identify) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		identity, ok := identify(r)
		if !ok {
			write(w, 401, map[string]string{"message": "Authentication required."})
			return
		}
		token := ""
		if cookie, err := r.Cookie(csrfCookieName(r)); err == nil {
			if data, e := base64.RawURLEncoding.DecodeString(cookie.Value); e == nil && len(data) == 32 {
				token = cookie.Value
			}
		}
		if token == "" {
			random := make([]byte, 32)
			if _, err := rand.Read(random); err != nil {
				write(w, 500, nil)
				return
			}
			token = base64.RawURLEncoding.EncodeToString(random)
		}
		http.SetCookie(w, &http.Cookie{Name: csrfCookieName(r), Value: token, Path: "/", Secure: r.TLS != nil, HttpOnly: true, SameSite: http.SameSiteStrictMode})
		write(w, 200, map[string]any{"user": identity.User, "admin": identity.Admin, "csrfToken": token})
	}
}

func csrfCookieName(r *http.Request) string {
	if r.TLS == nil {
		return "mnemo-csrf"
	}
	return "__Host-mnemo-csrf"
}

// BasicIdentity is only enabled by an explicit lab HTTP configuration. It never
// accepts identity headers from proxies and preserves verified certificate auth.
func BasicIdentity(adminPassword, viewerPassword string) Identify {
	admin := sha256.Sum256([]byte(adminPassword))
	viewer := sha256.Sum256([]byte(viewerPassword))
	adminName := sha256.Sum256([]byte("admin"))
	viewerName := sha256.Sum256([]byte("viewer"))
	return func(r *http.Request) (Identity, bool) {
		if identity, ok := CertificateIdentity(r); ok {
			return identity, true
		}
		name, password, ok := r.BasicAuth()
		if !ok {
			return Identity{}, false
		}
		candidate := sha256.Sum256([]byte(password))
		username := sha256.Sum256([]byte(name))
		isAdmin := subtle.ConstantTimeCompare(candidate[:], admin[:]) & subtle.ConstantTimeCompare(username[:], adminName[:])
		isViewer := subtle.ConstantTimeCompare(candidate[:], viewer[:]) & subtle.ConstantTimeCompare(username[:], viewerName[:])
		if isAdmin == 1 && len(adminPassword) >= 16 {
			return Identity{User: "admin", Admin: true}, true
		}
		if isViewer == 1 && len(viewerPassword) >= 16 {
			return Identity{User: "viewer"}, true
		}
		return Identity{}, false
	}
}
