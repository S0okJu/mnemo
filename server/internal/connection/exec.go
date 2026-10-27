package connection

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

var errPluginPolicy = errors.New("authentication plugin is disabled or not allowlisted")
var errPluginExecution = errors.New("authentication plugin failed")

const pluginPath = "/usr/local/bin:/usr/bin:/bin"

// ControlledRESTConfig is the only path from stored kubeconfig to a client.
// client-go's unrestricted exec/auth-provider implementation is never invoked.
func ControlledRESTConfig(data []byte, policy Policy) (*rest.Config, error) {
	config, err := clientcmd.RESTConfigFromKubeConfig(data)
	if err != nil {
		return nil, err
	}
	if config.AuthProvider != nil {
		return nil, errPluginPolicy
	}
	if config.ExecProvider == nil {
		return config, nil
	}
	plugin := config.ExecProvider.DeepCopy()
	if _, err = pluginCommand(plugin, policy); err != nil {
		return nil, err
	}
	config.ExecProvider = nil
	config.AuthProvider = nil
	config.BearerToken = ""
	config.BearerTokenFile = ""
	config.Username = ""
	config.Password = ""
	config.CertData = nil
	config.KeyData = nil
	config.CertFile = ""
	config.KeyFile = ""
	base := rest.CopyConfig(config)
	base.WrapTransport = nil
	config.WrapTransport = func(http.RoundTripper) http.RoundTripper {
		return &pluginTransport{base: base, plugin: plugin, policy: policy}
	}
	return config, nil
}
func pluginCommand(plugin *clientcmdapi.ExecConfig, policy Policy) (string, error) {
	if !policy.AllowExec || plugin == nil || plugin.InteractiveMode == clientcmdapi.AlwaysExecInteractiveMode {
		return "", errPluginPolicy
	}
	if plugin.APIVersion != "client.authentication.k8s.io/v1" && plugin.APIVersion != "client.authentication.k8s.io/v1beta1" {
		return "", errPluginPolicy
	}
	allowed := false
	for _, name := range policy.ExecAllowlist {
		if strings.TrimSpace(name) == plugin.Command && plugin.Command != "" {
			allowed = true
		}
	}
	if !allowed {
		return "", errPluginPolicy
	}
	// Operators may explicitly allow an absolute executable. Bare command names
	// resolve only in the image's fixed trusted directories, never server PATH/cwd.
	command := plugin.Command
	if !filepath.IsAbs(command) {
		if strings.ContainsAny(command, "/\\") {
			return "", errPluginPolicy
		}
		command = ""
		for _, dir := range strings.Split(pluginPath, ":") {
			candidate := filepath.Join(dir, plugin.Command)
			if info, err := os.Stat(candidate); err == nil && info.Mode().IsRegular() && info.Mode().Perm()&0111 != 0 {
				command = candidate
				break
			}
		}
		if command == "" {
			return "", errPluginPolicy
		}
	}
	for _, entry := range plugin.Env {
		permitted := false
		for _, name := range policy.ExecEnvAllowlist {
			if name == entry.Name {
				permitted = true
			}
		}
		if !permitted || entry.Name == "PATH" || entry.Name == "HOME" || entry.Name == "KUBERNETES_EXEC_INFO" || strings.ContainsAny(entry.Name, "=\x00") {
			return "", errPluginPolicy
		}
	}
	return command, nil
}

type pluginCredential struct {
	Token, Certificate, Key string
	Expires                 time.Time
}
type cappedBuffer struct{ bytes.Buffer }

func (b *cappedBuffer) Write(data []byte) (int, error) {
	if b.Len()+len(data) > 1<<20 {
		return 0, errPluginExecution
	}
	return b.Buffer.Write(data)
}
func executePlugin(ctx context.Context, plugin *clientcmdapi.ExecConfig, policy Policy, base *rest.Config) (pluginCredential, error) {
	var credential pluginCredential
	command, err := pluginCommand(plugin, policy)
	if err != nil {
		return credential, err
	}
	timeout := policy.ExecTimeout
	if timeout <= 0 || timeout > 5*time.Second {
		timeout = 5 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, command, plugin.Args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	cmd.WaitDelay = time.Second
	cmd.Env = []string{"PATH=" + pluginPath, "HOME=/nonexistent"}
	cmd.Dir = "/"
	for _, entry := range plugin.Env {
		cmd.Env = append(cmd.Env, entry.Name+"="+entry.Value)
	}
	info := map[string]any{"apiVersion": plugin.APIVersion, "kind": "ExecCredential", "spec": map[string]any{"interactive": false}}
	if plugin.ProvideClusterInfo {
		info["spec"].(map[string]any)["cluster"] = map[string]any{"server": base.Host, "tls-server-name": base.ServerName, "insecure-skip-tls-verify": base.Insecure, "certificate-authority-data": base.CAData}
	}
	encoded, err := json.Marshal(info)
	if err != nil {
		return credential, errPluginExecution
	}
	cmd.Env = append(cmd.Env, "KUBERNETES_EXEC_INFO="+string(encoded))
	var output cappedBuffer
	cmd.Stdout = &output
	cmd.Stderr = io.Discard
	if cmd.Run() != nil {
		return credential, errPluginExecution
	}
	var response struct {
		APIVersion string `json:"apiVersion"`
		Kind       string `json:"kind"`
		Status     struct {
			Token       string     `json:"token"`
			Certificate string     `json:"clientCertificateData"`
			Key         string     `json:"clientKeyData"`
			Expiration  *time.Time `json:"expirationTimestamp"`
		} `json:"status"`
	}
	decoder := json.NewDecoder(&output)
	if decoder.Decode(&response) != nil || decoder.Decode(new(any)) != io.EOF || response.APIVersion != plugin.APIVersion || response.Kind != "ExecCredential" {
		return credential, errPluginExecution
	}
	if response.Status.Token == "" && (response.Status.Certificate == "" || response.Status.Key == "") {
		return credential, errPluginExecution
	}
	if strings.ContainsAny(response.Status.Token, "\r\n") {
		return credential, errPluginExecution
	}
	expires := time.Now().Add(time.Minute)
	if response.Status.Expiration != nil {
		expires = *response.Status.Expiration
		if !expires.After(time.Now()) {
			return credential, errPluginExecution
		}
	}
	return pluginCredential{response.Status.Token, response.Status.Certificate, response.Status.Key, expires}, nil
}

type pluginTransport struct {
	base      *rest.Config
	plugin    *clientcmdapi.ExecConfig
	policy    Policy
	mu        sync.Mutex
	transport http.RoundTripper
	expires   time.Time
}

func (t *pluginTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	t.mu.Lock()
	if t.transport == nil || !time.Now().Before(t.expires.Add(-10*time.Second)) {
		credential, err := executePlugin(request.Context(), t.plugin, t.policy, t.base)
		if err != nil {
			t.mu.Unlock()
			return nil, err
		}
		config := rest.CopyConfig(t.base)
		config.BearerToken = credential.Token
		config.CertData = []byte(credential.Certificate)
		config.KeyData = []byte(credential.Key)
		transport, err := rest.TransportFor(config)
		if err != nil {
			t.mu.Unlock()
			return nil, errPluginExecution
		}
		if old, ok := t.transport.(interface{ CloseIdleConnections() }); ok {
			old.CloseIdleConnections()
		}
		t.transport = transport
		t.expires = credential.Expires
	}
	transport := t.transport
	t.mu.Unlock()
	response, err := transport.RoundTrip(request)
	if response != nil && response.StatusCode == http.StatusUnauthorized {
		t.mu.Lock()
		t.expires = time.Time{}
		t.mu.Unlock()
	}
	return response, err
}
