package connection

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"go.yaml.in/yaml/v3"

	authorization "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

// Validate only materializes the selected context. Errors deliberately exclude
// parser and transport details, which may contain credential material.
func Validate(ctx context.Context, s Submission, p Policy) (Validation, Metadata, []byte, *rest.Config, int) {
	v := Validation{Checks: []Check{}}
	m := Metadata{Source: "kubeconfig", Status: "not-configured"}
	fail := func(id, msg string, status int) (Validation, Metadata, []byte, *rest.Config, int) {
		v.Checks = append(v.Checks, Check{id, "error", msg})
		if m.Configured && m.Status != "connected" {
			m.Message = msg
		}
		return v, m, nil, nil, status
	}
	ok := func(id, msg string) { v.Checks = append(v.Checks, Check{id, "ok", msg}) }
	if len(s.Kubeconfig) > 1<<20 {
		return fail("yaml", "Kubeconfig exceeds 1 MiB.", 400)
	}
	if !safeYAML(s.Kubeconfig) {
		return fail("yaml", "Use a single YAML document without custom tags or aliases.", 400)
	}
	cfg, err := clientcmd.Load([]byte(s.Kubeconfig))
	if err != nil {
		return fail("yaml", "Invalid kubeconfig YAML.", 400)
	}
	ok("yaml", "Kubeconfig parsed.")
	selected := s.Context
	if selected == "" {
		selected = cfg.CurrentContext
	}
	c := cfg.Contexts[selected]
	if c == nil {
		return fail("contexts", "Select a defined context.", 400)
	}
	ok("contexts", "Context exists.")
	cluster := cfg.Clusters[c.Cluster]
	if cluster == nil {
		return fail("cluster-ref", "Context references an undefined cluster.", 400)
	}
	ok("cluster-ref", "Cluster exists.")
	user := cfg.AuthInfos[c.AuthInfo]
	if user == nil {
		return fail("user-ref", "Context references an undefined user.", 400)
	}
	ok("user-ref", "User exists.")
	u, err := url.Parse(cluster.Server)
	if err != nil || u.Hostname() == "" || (u.Scheme != "https" && u.Scheme != "http") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return fail("server", "Use an HTTP(S) server URL without credentials, query or fragment.", 400)
	}
	ok("server", "Server URL is valid.")
	for _, field := range []struct{ name, value string }{{"certificate-authority", cluster.CertificateAuthority}, {"client-certificate", user.ClientCertificate}, {"client-key", user.ClientKey}, {"tokenFile", user.TokenFile}} {
		if field.value != "" {
			return fail("file-"+field.name, "File references are not supported. Run kubectl config view --flatten --minify.", 400)
		}
	}
	auth := ""
	switch {
	case user.Exec != nil:
		if _, err = pluginCommand(user.Exec, p); err != nil {
			return fail("plugin-auth", "Exec authentication is disabled or not allowlisted by server policy.", 422)
		}
		auth = "exec"
		ok("plugin-auth", "Exec command is permitted by server policy.")
	case user.AuthProvider != nil:
		return fail("plugin-auth", "Legacy auth-provider authentication is unsupported. Use an allowlisted ExecCredential plugin.", 422)
	case user.Token != "":
		auth = "token"
	case len(user.ClientCertificateData) > 0 && len(user.ClientKeyData) > 0:
		auth = "client-certificate"
	case user.Username != "" && user.Password != "":
		auth = "basic"
	default:
		return fail("no-credentials", "The selected user has no supported credentials.", 400)
	}
	if user.Impersonate != "" || user.ImpersonateUID != "" || len(user.ImpersonateGroups) > 0 || len(user.ImpersonateUserExtra) > 0 {
		return fail("user-ref", "Impersonation is not permitted.", 400)
	}
	if cluster.ProxyURL != "" {
		return fail("server", "Kubeconfig proxy URLs are not permitted.", 400)
	}
	for _, warning := range []struct {
		id     string
		active bool
	}{{"insecure", cluster.InsecureSkipTLSVerify}, {"plain-http", u.Scheme == "http"}} {
		if warning.active {
			if p.RequireTLSVerify {
				return fail(warning.id, "Server policy requires verified TLS.", 400)
			}
			v.Checks = append(v.Checks, Check{warning.id, "warning", "Connection does not verify encrypted server identity."})
		}
	}
	cfg.CurrentContext = selected
	if err = clientcmdapi.MinifyConfig(cfg); err != nil {
		return fail("contexts", "Could not select context.", 400)
	}
	if s.Namespace != "" {
		cfg.Contexts[selected].Namespace = s.Namespace
	}
	data, err := clientcmd.Write(*cfg)
	if err != nil {
		return fail("yaml", "Could not encode selected context.", 400)
	}
	rc, err := ControlledRESTConfig(data, p)
	if err != nil {
		return fail("no-credentials", "Invalid TLS or authentication configuration.", 400)
	}
	rc.Timeout = 5 * time.Second
	transport, err := rest.TransportFor(rc)
	if err != nil {
		return fail("no-credentials", "Invalid TLS credentials.", 400)
	}
	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(probeCtx, http.MethodGet, strings.TrimRight(cluster.Server, "/")+"/version", nil)
	if err != nil {
		return fail("server", "Invalid server URL.", 400)
	}
	response, err := (&http.Client{Transport: transport, Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}).Do(req)
	m = Metadata{Configured: true, Source: "kubeconfig", Context: selected, Cluster: c.Cluster, Server: cluster.Server, User: c.AuthInfo, AuthType: auth, Namespace: cfg.Contexts[selected].Namespace, Status: "unreachable", CheckedAt: time.Now().UTC().Format(time.RFC3339)}
	if err != nil {
		status := 502
		var timeout net.Error
		if probeCtx.Err() != nil || errors.As(err, &timeout) && timeout.Timeout() {
			status = 504
		}
		return fail("reach", "Cluster could not be reached from the server.", status)
	}
	defer response.Body.Close()
	if response.StatusCode == 401 || response.StatusCode == 403 {
		m.Status = "unauthorized"
		return fail("reach", "Cluster rejected these credentials.", response.StatusCode)
	}
	if response.StatusCode != 200 {
		return fail("reach", "Cluster version probe failed.", 502)
	}
	var version struct {
		GitVersion string `json:"gitVersion"`
	}
	if json.NewDecoder(http.MaxBytesReader(nil, response.Body, 1<<20)).Decode(&version) != nil || !gitVersionPattern.MatchString(version.GitVersion) {
		return fail("reach", "Cluster returned an invalid version response.", 502)
	}
	m.Status = "connected"
	m.Version = version.GitVersion
	v.Version = version.GitVersion
	ok("reach", "Cluster version probe succeeded.")
	client, err := kubernetes.NewForConfig(rc)
	if err != nil {
		return fail("reach", "Could not create cluster client.", 400)
	}
	rbacCtx, rbacCancel := context.WithTimeout(ctx, 5*time.Second)
	defer rbacCancel()
	for _, resource := range []struct{ group, name, namespace string }{{"", "nodes", ""}, {"", "namespaces", ""}, {"", "pods", m.Namespace}, {"apps", "deployments", m.Namespace}, {"apps", "statefulsets", m.Namespace}, {"apps", "daemonsets", m.Namespace}, {"batch", "jobs", m.Namespace}, {"batch", "cronjobs", m.Namespace}} {
		result, e := client.AuthorizationV1().SelfSubjectAccessReviews().Create(rbacCtx, &authorization.SelfSubjectAccessReview{Spec: authorization.SelfSubjectAccessReviewSpec{ResourceAttributes: &authorization.ResourceAttributes{Group: resource.group, Resource: resource.name, Namespace: resource.namespace, Verb: "list"}}}, metav1.CreateOptions{})
		if e != nil || !result.Status.Allowed {
			v.Checks = append(v.Checks, Check{"rbac", "warning", "Some read permissions could not be confirmed; individual views may be unavailable."})
			v.OK = true
			return v, m, data, rc, 200
		}
	}
	ok("rbac", "Required read permissions confirmed.")
	v.OK = true
	return v, m, data, rc, 200
}

var gitVersionPattern = regexp.MustCompile(`^v[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,5}([-+][0-9A-Za-z.-]{1,128})?$`)

func safeYAML(input string) bool {
	decoder := yaml.NewDecoder(strings.NewReader(input))
	var root yaml.Node
	if decoder.Decode(&root) != nil {
		return false
	}
	var extra yaml.Node
	if decoder.Decode(&extra) != io.EOF {
		return false
	}
	var valid func(*yaml.Node, int) bool
	valid = func(n *yaml.Node, depth int) bool {
		if depth > 64 || n.Kind == yaml.AliasNode {
			return false
		}
		switch n.Tag {
		case "", "!!map", "!!seq", "!!str", "!!bool", "!!int", "!!float", "!!null":
		default:
			return false
		}
		for _, child := range n.Content {
			if !valid(child, depth+1) {
				return false
			}
		}
		return true
	}
	return valid(&root, 0)
}
