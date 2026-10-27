package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"mnemo/server/internal/connection"
	"mnemo/server/internal/testdb"
)

func TestProjectionPaginationRelationsAndGenerationIsolation(t *testing.T) {
	ctx := context.Background()
	pool := testdb.Pool(t)
	vault, _ := connection.NewVault(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	store := &connection.Store{Pool: pool, Vault: vault}
	api := &API{Store: store, Identify: func(*http.Request) (Identity, bool) { return Identity{User: "reader"}, true }}
	handler := api.Handler()
	request := func(path string, status int) map[string]json.RawMessage {
		t.Helper()
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != status {
			t.Fatalf("%s got %d want %d: %s", path, w.Code, status, w.Body.String())
		}
		var body map[string]json.RawMessage
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		return body
	}
	request("/api/v1/nodes", 409)
	request("/api/v1/relations", 409)
	metadata := connection.Metadata{Configured: true, Source: "kubeconfig", Status: "connected"}
	generation, err := store.Replace(ctx, metadata, []byte("test"), "admin")
	if err != nil {
		t.Fatal(err)
	}
	ids := map[string]int64{}
	for _, resource := range []struct{ uid, kind, namespace, name string }{{"node", "Node", "", "node-a"}, {"pod-a", "Pod", "work", "a"}, {"pod-b", "Pod", "work", "b"}, {"pod-c", "Pod", "other", "a"}} {
		data, _ := json.Marshal(map[string]any{"kind": resource.kind, "metadata": map[string]string{"uid": resource.uid, "name": resource.name, "namespace": resource.namespace}})
		var id int64
		err = pool.QueryRow(ctx, `INSERT INTO resources(connection_id,generation,uid,api_group,kind,namespace,name,data,resource_version) VALUES(1,$1,$2,'',$3,$4,$5,$6,'1') RETURNING id`, generation, resource.uid, resource.kind, resource.namespace, resource.name, data).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		ids[resource.uid] = id
	}
	if _, err = pool.Exec(ctx, `INSERT INTO sync_states(connection_id,generation,kind,initialized,stale,last_success_at) VALUES(1,$1,'Node',true,false,now()),(1,$1,'Pod',true,false,now())`, generation); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `INSERT INTO resource_relations(source_id,target_id,relation_type,evidence) VALUES($1,$2,'scheduled-on','{"method":"binding-field","field":"spec.nodeName"}')`, ids["pod-a"], ids["node"]); err != nil {
		t.Fatal(err)
	}
	body := request("/api/v1/pods?namespace=work&limit=1&offset=1", 200)
	var total int
	_ = json.Unmarshal(body["total"], &total)
	if total != 2 {
		t.Fatal("filtered total incorrect", total)
	}
	var items []struct {
		Metadata struct {
			UID string `json:"uid"`
		} `json:"metadata"`
	}
	if err = json.Unmarshal(body["items"], &items); err != nil || len(items) != 1 || items[0].Metadata.UID != "pod-b" {
		t.Fatal("unstable pagination", string(body["items"]), err)
	}
	body = request("/api/v1/relations?uid=pod-a&direction=outgoing", 200)
	_ = json.Unmarshal(body["total"], &total)
	if total != 1 {
		t.Fatal("missing relation", total)
	}
	body = request("/api/v1/relations?uid=pod-a&direction=incoming", 200)
	_ = json.Unmarshal(body["total"], &total)
	if total != 0 {
		t.Fatal("direction filter ignored")
	}
	request("/api/v1/relations?direction=incoming", 400)
	if _, err = pool.Exec(ctx, "UPDATE sync_states SET error='forbidden',stale=true WHERE kind='Pod'"); err != nil {
		t.Fatal(err)
	}
	request("/api/v1/pods", 403)
	body = request("/api/v1/relations", 200)
	_ = json.Unmarshal(body["total"], &total)
	if total != 0 {
		t.Fatal("relations exposed permission-revoked projections")
	}
	if _, err = store.Replace(ctx, metadata, []byte("new-cluster"), "admin"); err != nil {
		t.Fatal(err)
	}
	body = request("/api/v1/relations", 200)
	_ = json.Unmarshal(body["total"], &total)
	if total != 0 {
		t.Fatal("cross-generation relation contamination")
	}
	if _, err = store.Replace(ctx, connection.Metadata{Source: "kubeconfig", Status: "not-configured"}, nil, "admin"); err != nil {
		t.Fatal(err)
	}
	request("/api/v1/pods", 409)
	request("/api/v1/relations", 409)
}
