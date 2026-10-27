package connection

import (
	"context"
	"encoding/base64"
	"testing"

	"mnemo/server/internal/testdb"
)

func TestStorePersistsEncryptedAndFencesStatus(t *testing.T) {
	pool := testdb.Pool(t)
	vault, _ := NewVault(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	store := &Store{Pool: pool, Vault: vault}
	ctx := context.Background()
	m, plain, generation, err := store.Load(ctx)
	if err != nil || m.Configured || plain != nil || generation != 0 {
		t.Fatal(m, generation, err)
	}
	original := Metadata{Configured: true, Source: "kubeconfig", Context: "test", Server: "https://cluster.invalid", Status: "connected"}
	generation, err = store.Replace(ctx, original, []byte("private-token"), "admin")
	if err != nil {
		t.Fatal(err)
	}
	var encrypted []byte
	if err = pool.QueryRow(ctx, "SELECT encrypted_kubeconfig FROM cluster_connections").Scan(&encrypted); err != nil {
		t.Fatal(err)
	}
	if string(encrypted) == "private-token" {
		t.Fatal("plaintext at rest")
	}
	restarted := &Store{Pool: pool, Vault: vault}
	m, plain, loaded, err := restarted.Load(ctx)
	if err != nil || !m.Configured || string(plain) != "private-token" || loaded != generation {
		t.Fatal(m, loaded, err)
	}
	next, err := store.Replace(ctx, Metadata{Source: "kubeconfig", Status: "not-configured"}, nil, "admin")
	if err != nil || next <= generation {
		t.Fatal(next, err)
	}
	if err = store.UpdateStatus(ctx, generation, original); err != nil {
		t.Fatal(err)
	}
	m, plain, loaded, err = store.Load(ctx)
	if err != nil || m.Configured || len(plain) > 0 || loaded != next {
		t.Fatal("old probe overwrote disconnect", m, err)
	}
	var actions int
	if err = pool.QueryRow(ctx, "SELECT count(*) FROM audit_logs").Scan(&actions); err != nil || actions != 2 {
		t.Fatal(actions, err)
	}
}

func TestInitializeCannotOverwriteRegistrationOrDisconnect(t *testing.T) {
	pool := testdb.Pool(t)
	vault, _ := NewVault(base64.StdEncoding.EncodeToString(make([]byte, 32)))
	store := &Store{Pool: pool, Vault: vault}
	ctx := context.Background()
	ui := Metadata{Configured: true, Source: "kubeconfig", Context: "ui-registration", Status: "connected"}
	generation, err := store.Replace(ctx, ui, []byte("ui-secret"), "admin")
	if err != nil {
		t.Fatal(err)
	}
	bootstrap := Metadata{Configured: true, Source: "kubeconfig", Context: "slow-bootstrap", Status: "connected"}
	if got, e := store.Initialize(ctx, bootstrap, []byte("bootstrap-secret"), "bootstrap"); e != nil || got != generation {
		t.Fatal(got, e)
	}
	m, plain, _, err := store.Load(ctx)
	if err != nil || m.Context != ui.Context || string(plain) != "ui-secret" {
		t.Fatal("bootstrap overwrote UI registration", m, err)
	}
	disconnected, err := store.Replace(ctx, Metadata{Source: "kubeconfig", Status: "not-configured"}, nil, "admin")
	if err != nil {
		t.Fatal(err)
	}
	if got, e := store.Initialize(ctx, bootstrap, []byte("bootstrap-secret"), "bootstrap"); e != nil || got != disconnected {
		t.Fatal(got, e)
	}
	m, _, _, err = store.Load(ctx)
	if err != nil || m.Configured {
		t.Fatal("bootstrap resurrected disconnected credentials", m, err)
	}
	var audits int
	if err = pool.QueryRow(ctx, "SELECT count(*) FROM audit_logs").Scan(&audits); err != nil || audits != 2 {
		t.Fatal("skipped initialization created audit actions", audits, err)
	}
}
