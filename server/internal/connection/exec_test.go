package connection

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"k8s.io/client-go/rest"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

func fixturePlugin(t *testing.T, script string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "plugin")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+script), 0700); err != nil {
		t.Fatal(err)
	}
	return path
}
func credentialJSON(token string, expires time.Time) []byte {
	data, _ := json.Marshal(map[string]any{"apiVersion": "client.authentication.k8s.io/v1", "kind": "ExecCredential", "status": map[string]any{"token": token, "expirationTimestamp": expires}})
	return data
}
func TestExecPolicyAndMinimalEnvironment(t *testing.T) {
	t.Setenv("MNEMO_ENCRYPTION_KEY", "must-not-reach-plugin")
	command := fixturePlugin(t, `test -z "${MNEMO_ENCRYPTION_KEY-}" || exit 1
test "$HOME" = /nonexistent || exit 1
test -n "$KUBERNETES_EXEC_INFO" || exit 1
printf '%s' '{"apiVersion":"client.authentication.k8s.io/v1","kind":"ExecCredential","status":{"token":"plugin-token"}}'
`)
	plugin := &clientcmdapi.ExecConfig{Command: command, APIVersion: "client.authentication.k8s.io/v1", InteractiveMode: clientcmdapi.NeverExecInteractiveMode}
	for _, policy := range []Policy{{}, {AllowExec: true}, {ExecAllowlist: []string{command}}} {
		if _, err := pluginCommand(plugin, policy); err == nil {
			t.Fatal("plugin policy bypass")
		}
	}
	policy := Policy{AllowExec: true, ExecAllowlist: []string{command}}
	credential, err := executePlugin(context.Background(), plugin, policy, &rest.Config{Host: "https://cluster.invalid"})
	if err != nil || credential.Token != "plugin-token" {
		t.Fatal("minimal environment fixture failed", err)
	}
	plugin.Env = []clientcmdapi.ExecEnvVar{{Name: "MNEMO_ENCRYPTION_KEY", Value: "injected"}}
	if _, err = pluginCommand(plugin, policy); err == nil {
		t.Fatal("unapproved environment accepted")
	}
	plugin.Env = nil
	plugin.InteractiveMode = clientcmdapi.AlwaysExecInteractiveMode
	if _, err = pluginCommand(plugin, policy); err == nil {
		t.Fatal("interactive plugin accepted")
	}
}
func TestExecTimeoutMalformedAndOversizeOutput(t *testing.T) {
	for _, tt := range []struct{ name, script string }{
		{"timeout", "sleep 30\n"},
		{"malformed", "printf '%s' 'not-json'\n"},
		{"oversized", "head -c 1048577 /dev/zero\n"},
		{"expired", "printf '%s' '{\"apiVersion\":\"client.authentication.k8s.io/v1\",\"kind\":\"ExecCredential\",\"status\":{\"token\":\"expired\",\"expirationTimestamp\":\"2000-01-01T00:00:00Z\"}}'\n"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			command := fixturePlugin(t, tt.script)
			plugin := &clientcmdapi.ExecConfig{Command: command, APIVersion: "client.authentication.k8s.io/v1"}
			start := time.Now()
			_, err := executePlugin(context.Background(), plugin, Policy{AllowExec: true, ExecAllowlist: []string{command}, ExecTimeout: 100 * time.Millisecond}, &rest.Config{})
			if err == nil {
				t.Fatal("invalid plugin output accepted")
			}
			if time.Since(start) > 2*time.Second {
				t.Fatal("plugin timeout did not terminate subprocess group")
			}
		})
	}
}
func TestControlledExecRefreshesAndPersistsOnlyPluginConfiguration(t *testing.T) {
	credentialFile := filepath.Join(t.TempDir(), "credential.json")
	if err := os.WriteFile(credentialFile, credentialJSON("initial-token", time.Now().Add(time.Hour)), 0600); err != nil {
		t.Fatal(err)
	}
	command := fixturePlugin(t, "cat \"$1\"\n")
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/version" {
			fmt.Fprint(w, `{"gitVersion":"v1.34.3"}`)
			return
		}
		if r.URL.Path == "/refresh" {
			if r.Header.Get("Authorization") == "Bearer initial-token" {
				w.WriteHeader(401)
				return
			}
			if r.Header.Get("Authorization") != "Bearer renewed-token" {
				t.Error("refreshed token not supplied")
			}
			w.WriteHeader(200)
			return
		}
		fmt.Fprint(w, `{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview","status":{"allowed":true}}`)
	}))
	defer server.Close()
	auth := fmt.Sprintf("exec: {apiVersion: client.authentication.k8s.io/v1, interactiveMode: Never, command: %q, args: [%q]}", command, credentialFile)
	input := strings.Replace(sample(server.URL, auth), "cluster: {server:", "cluster: {insecure-skip-tls-verify: true, server:", 1)
	policy := Policy{AllowExec: true, ExecAllowlist: []string{command}}
	v, m, minified, config, status := Validate(context.Background(), Submission{Kubeconfig: input}, policy)
	if !v.OK || status != 200 || m.AuthType != "exec" {
		t.Fatal(v, status)
	}
	if strings.Contains(string(minified), "initial-token") {
		t.Fatal("ephemeral plugin credential persisted")
	}
	if config.ExecProvider != nil {
		t.Fatal("unrestricted client-go exec provider retained")
	}
	transport, err := rest.TransportFor(config)
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Transport: transport}
	response, err := client.Get(server.URL + "/refresh")
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 401 {
		t.Fatal("expected expired credentials")
	}
	if err = os.WriteFile(credentialFile, credentialJSON("renewed-token", time.Now().Add(time.Hour)), 0600); err != nil {
		t.Fatal(err)
	}
	response, err = client.Get(server.URL + "/refresh")
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal("credential did not refresh", response.StatusCode)
	}
	if _, err = ControlledRESTConfig(minified, Policy{}); err == nil {
		t.Fatal("policy revocation did not disable stored exec config")
	}
}
