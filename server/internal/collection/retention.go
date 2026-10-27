package collection

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Prune removes a bounded batch. Active-generation current resources are never
// removed. A lifecycle summary can retain its projection until its own expiry.
// Relations are current topology, not historical reconstruction evidence.
func Prune(ctx context.Context, pool *pgxpool.Pool, retention time.Duration, batch int) error {
	if retention <= 0 {
		retention = 30 * 24 * time.Hour
	}
	if batch < 1 || batch > 1000 {
		batch = 200
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `DELETE FROM resource_changes WHERE id IN (SELECT id FROM resource_changes WHERE expires_at<now() ORDER BY expires_at,id LIMIT $1 FOR UPDATE SKIP LOCKED)`, batch); err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `SELECT r.id FROM resources r WHERE
 ((r.deleted_at IS NOT NULL AND r.deleted_at<now()-make_interval(secs => $1)) OR
 (r.generation<>(SELECT generation FROM cluster_connections WHERE id=1) AND r.observed_at<now()-make_interval(secs => $1)))
 AND NOT EXISTS(SELECT 1 FROM resource_changes c WHERE c.resource_id=r.id)
 ORDER BY r.id LIMIT $2 FOR UPDATE SKIP LOCKED`, retention.Seconds(), batch)
	if err != nil {
		return err
	}
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	if len(ids) > 0 {
		if _, err = tx.Exec(ctx, "DELETE FROM resource_relations WHERE source_id=ANY($1::bigint[]) OR target_id=ANY($1::bigint[])", ids); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, "DELETE FROM resources WHERE id=ANY($1::bigint[])", ids); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
func Maintain(ctx context.Context, pool *pgxpool.Pool) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			attempt, cancel := context.WithTimeout(ctx, 10*time.Second)
			_ = Prune(attempt, pool, 30*24*time.Hour, 200)
			cancel()
		}
	}
}
