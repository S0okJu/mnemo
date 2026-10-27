package httpapi

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"mnemo/server/internal/collection"
	"mnemo/server/internal/connection"
	"mnemo/server/internal/testdb"
)

func TestCapabilitiesDoNotReportAbsentDuringInitialization(t *testing.T) {
	pool := testdb.Pool(t)
	vault, _ := connection.NewVault(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	store := &connection.Store{Pool: pool, Vault: vault}
	ctx := context.Background()
	generation, err := store.Replace(ctx, connection.Metadata{Configured: true, Source: "kubeconfig"}, []byte("test"), "admin")
	if err != nil {
		t.Fatal(err)
	}
	api := &API{Store: store, Identify: func(*http.Request) (Identity, bool) { return Identity{User: "reader"}, true }}
	handler := api.Handler()
	get := func(status int) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/integrations/kube-ovn/capabilities", nil))
		if w.Code != status {
			t.Fatalf("got %d want %d: %s", w.Code, status, w.Body.String())
		}
		return w
	}
	get(503)
	for _, kind := range collection.Kinds {
		if kind.GVR.Group != "kubeovn.io" {
			continue
		}
		if _, err = pool.Exec(ctx, "INSERT INTO sync_states(connection_id,generation,kind,initialized,stale,error) VALUES(1,$1,$2,false,true,'missing-crd')", generation, kind.Name); err != nil {
			t.Fatal(err)
		}
	}
	var absent struct {
		Installed bool `json:"installed"`
	}
	if err = json.Unmarshal(get(200).Body.Bytes(), &absent); err != nil || absent.Installed {
		t.Fatal("missing CRDs reported installed", err)
	}
	if _, err = pool.Exec(ctx, "UPDATE sync_states SET initialized=true,stale=false,error=NULL WHERE kind='Vpc'"); err != nil {
		t.Fatal(err)
	}
	var present struct {
		Installed bool `json:"installed"`
	}
	if err = json.Unmarshal(get(200).Body.Bytes(), &present); err != nil || !present.Installed {
		t.Fatal("installed VPC absent", err)
	}
	if _, err = pool.Exec(ctx, "UPDATE sync_states SET stale=true,error='unavailable' WHERE kind='Vpc'"); err != nil {
		t.Fatal(err)
	}
	get(503)
}
