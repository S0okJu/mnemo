package connection

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func sample(server, auth string) string {
	return fmt.Sprintf(`apiVersion: v1
kind: Config
current-context: selected
contexts:
- name: selected
  context: {cluster: local, user: reader}
- name: discarded
  context: {cluster: other, user: other}
clusters:
- name: local
  cluster: {server: %q}
- name: other
  cluster: {server: "https://discarded.invalid"}
users:
- name: reader
  user:
    %s
- name: other
  user: {token: discarded-secret}
`, server, auth)
}

func TestValidateMinifiesAndDoesNotReturnCredentials(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer private-token" {
			t.Error("missing cluster authentication")
		}
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/version" {
			fmt.Fprint(w, `{"gitVersion":"v1.34.1"}`)
			return
		}
		fmt.Fprint(w, `{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","status":{"allowed":true}}`)
	}))
	defer server.Close()
	input := strings.Replace(sample(server.URL, "token: private-token"), "cluster: {server:", "cluster: {insecure-skip-tls-verify: true, server:", 1)
	v, m, plain, _, code := Validate(context.Background(), Submission{Kubeconfig: input}, Policy{})
	if !v.OK || code != 200 || m.Version != "v1.34.1" {
		t.Fatalf("unexpected validation %+v %d", v, code)
	}
	if strings.Contains(string(plain), "discarded") {
		t.Fatal("unselected context retained")
	}
	metadata, _ := json.Marshal(m)
	validation, _ := json.Marshal(v)
	if strings.Contains(string(metadata)+string(validation), "private-token") {
		t.Fatal("credential in response")
	}
}

func TestPolicyBeforeOutboundCalls(t *testing.T) {
	for _, tt := range []struct {
		name, auth string
		policy     Policy
		code       int
		check      string
	}{
		{"file", "tokenFile: /tmp/token", Policy{}, 400, "file-tokenFile"},
		{"exec", "exec: {apiVersion: client.authentication.k8s.io/v1, command: dangerous}", Policy{}, 422, "plugin-auth"},
		{"tls", "token: secret", Policy{RequireTLSVerify: true}, 400, "plain-http"},
		{"empty", "{}", Policy{}, 400, "no-credentials"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			v, _, _, _, code := Validate(context.Background(), Submission{Kubeconfig: sample("http://127.0.0.1:1", tt.auth)}, tt.policy)
			if code != tt.code || v.OK || v.Checks[len(v.Checks)-1].ID != tt.check {
				t.Fatalf("unexpected validation %+v %d", v, code)
			}
		})
	}
}

func TestUnauthorizedAndRBACWarning(t *testing.T) {
	for _, status := range []int{401, 403, 200} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/version" {
					if status != 200 {
						w.WriteHeader(status)
						return
					}
					fmt.Fprint(w, `{"gitVersion":"v1.34.1"}`)
					return
				}
				w.WriteHeader(403)
			}))
			defer server.Close()
			v, m, _, _, code := Validate(context.Background(), Submission{Kubeconfig: sample(server.URL, "token: private-token")}, Policy{})
			if code != status {
				t.Fatalf("got %d want %d", code, status)
			}
			if status == 200 {
				if !v.OK || v.Checks[len(v.Checks)-1].ID != "rbac" || v.Checks[len(v.Checks)-1].Level != "warning" {
					t.Fatal(v)
				}
			} else if m.Status != "unauthorized" || v.OK {
				t.Fatal(m, v)
			}
		})
	}
}
