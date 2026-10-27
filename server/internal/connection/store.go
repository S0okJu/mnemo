package connection

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	Pool  *pgxpool.Pool
	Vault *Vault
}

func (s *Store) Load(ctx context.Context) (Metadata, []byte, int64, error) {
	var encoded, encrypted []byte
	var generation int64
	err := s.Pool.QueryRow(ctx, "SELECT metadata,encrypted_kubeconfig,generation FROM cluster_connections WHERE id=1").Scan(&encoded, &encrypted, &generation)
	if errors.Is(err, pgx.ErrNoRows) {
		return Metadata{Source: "kubeconfig", Status: "not-configured"}, nil, 0, nil
	}
	if err != nil {
		return Metadata{}, nil, 0, err
	}
	var m Metadata
	if err = json.Unmarshal(encoded, &m); err != nil {
		return m, nil, 0, err
	}
	if len(encrypted) == 0 {
		return m, nil, generation, nil
	}
	plain, err := s.Vault.Open(encrypted, []byte(fmt.Sprint(generation)))
	return m, plain, generation, err
}

// Replace serializes administrators and records the audit entry in the same
// transaction. Generations never reset on disconnect, preventing stale writes.
func (s *Store) Replace(ctx context.Context, m Metadata, plain []byte, actor string) (int64, error) {
	return s.replace(ctx, m, plain, actor, false)
}

// Initialize atomically refuses to overwrite any existing record, including a
// disconnect tombstone. Slow bootstrap probes cannot replace a UI registration.
func (s *Store) Initialize(ctx context.Context, m Metadata, plain []byte, actor string) (int64, error) {
	return s.replace(ctx, m, plain, actor, true)
}
func (s *Store) replace(ctx context.Context, m Metadata, plain []byte, actor string, onlyAbsent bool) (int64, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(714821)"); err != nil {
		return 0, err
	}
	var generation int64
	var previous []byte
	var previousMetadata []byte
	err = tx.QueryRow(ctx, "SELECT generation,encrypted_kubeconfig,metadata FROM cluster_connections WHERE id=1 FOR UPDATE").Scan(&generation, &previous, &previousMetadata)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	if onlyAbsent && err == nil {
		return generation, nil
	}
	generation++
	var encrypted []byte
	if len(plain) > 0 {
		encrypted = s.Vault.Seal(plain, []byte(fmt.Sprint(generation)))
	}
	encoded, err := json.Marshal(m)
	if err != nil {
		return 0, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO cluster_connections(id,generation,metadata,encrypted_kubeconfig) VALUES(1,$1,$2,$3)
 ON CONFLICT(id) DO UPDATE SET generation=EXCLUDED.generation,metadata=EXCLUDED.metadata,encrypted_kubeconfig=EXCLUDED.encrypted_kubeconfig,updated_at=now()`, generation, encoded, encrypted)
	if err != nil {
		return 0, err
	}
	action := "register"
	if len(previous) > 0 {
		action = "replace"
	}
	if len(plain) == 0 && !m.Configured {
		action = "disconnect"
	}
	if m.Source == "in-cluster" {
		action = "in-cluster"
	}
	audited := m
	if action == "disconnect" {
		_ = json.Unmarshal(previousMetadata, &audited)
	}
	_, err = tx.Exec(ctx, "INSERT INTO audit_logs(actor,action,context_name,server_url) VALUES($1,$2,$3,$4)", actor, action, audited.Context, audited.Server)
	if err != nil {
		return 0, err
	}
	return generation, tx.Commit(ctx)
}

func (s *Store) UpdateStatus(ctx context.Context, generation int64, m Metadata) error {
	encoded, err := json.Marshal(m)
	if err != nil {
		return err
	}
	_, err = s.Pool.Exec(ctx, "UPDATE cluster_connections SET metadata=$1,updated_at=now() WHERE id=1 AND generation=$2", encoded, generation)
	return err
}
