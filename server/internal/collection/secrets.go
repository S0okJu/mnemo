package collection

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/metadata"
	"k8s.io/client-go/rest"
)

// Secrets use metadata content negotiation and are never watched as full objects.
// Their data, stringData, type, and key names are intentionally unavailable.
type safeDynamic struct {
	dynamic.Interface
	metadata metadata.Interface
}
type secretList struct {
	dynamic.NamespaceableResourceInterface
	metadata metadata.ResourceInterface
	getter   metadata.Getter
}

func metadataSafeClient(config *rest.Config, client dynamic.Interface) (dynamic.Interface, error) {
	meta, err := metadata.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	return &safeDynamic{client, meta}, nil
}
func (c *safeDynamic) Resource(gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	resource := c.Interface.Resource(gvr)
	if gvr.Group != "" || gvr.Resource != "secrets" {
		return resource
	}
	getter := c.metadata.Resource(gvr)
	return &secretList{NamespaceableResourceInterface: resource, metadata: getter, getter: getter}
}
func (s *secretList) Namespace(namespace string) dynamic.ResourceInterface {
	return &secretList{NamespaceableResourceInterface: s.NamespaceableResourceInterface, metadata: s.getter.Namespace(namespace), getter: s.getter}
}
func (s *secretList) List(ctx context.Context, options metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	page, err := s.metadata.List(ctx, options)
	if err != nil {
		return nil, err
	}
	result := &unstructured.UnstructuredList{}
	result.SetContinue(page.Continue)
	result.SetResourceVersion(page.ResourceVersion)
	for _, entry := range page.Items {
		entry.SetAnnotations(nil)
		entry.SetManagedFields(nil)
		object, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&entry)
		if err != nil {
			return nil, err
		}
		value := unstructured.Unstructured{Object: object}
		value.SetKind("Secret")
		value.SetAPIVersion("v1")
		result.Items = append(result.Items, value)
	}
	return result, nil
}
