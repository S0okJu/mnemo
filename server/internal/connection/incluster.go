package connection

import (
	"context"
	"os"
	"strings"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

func ProbeInCluster(ctx context.Context, policy Policy) (Metadata, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return Metadata{}, err
	}
	if err = rest.LoadTLSFiles(config); err != nil {
		return Metadata{}, err
	}
	cfg := clientcmdapi.NewConfig()
	cfg.CurrentContext = "in-cluster"
	cfg.Contexts["in-cluster"] = &clientcmdapi.Context{Cluster: "in-cluster", AuthInfo: "service-account"}
	if ns, e := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace"); e == nil {
		cfg.Contexts["in-cluster"].Namespace = strings.TrimSpace(string(ns))
	}
	cfg.Clusters["in-cluster"] = &clientcmdapi.Cluster{Server: config.Host, CertificateAuthorityData: config.CAData}
	cfg.AuthInfos["service-account"] = &clientcmdapi.AuthInfo{Token: config.BearerToken}
	data, err := clientcmd.Write(*cfg)
	if err != nil {
		return Metadata{}, err
	}
	_, metadata, _, _, _ := Validate(ctx, Submission{Kubeconfig: string(data)}, policy)
	metadata.Source = "in-cluster"
	metadata.Context = "in-cluster"
	metadata.Configured = true
	return metadata, nil
}
