package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"mnemo/server/migrations"
)

func main() {
	if err := run(); err != nil {
		log.Print("migration failed (database details redacted)")
		os.Exit(1)
	}
}
func run() error {
	parent, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	timeout := 2 * time.Minute
	if value := os.Getenv("MNEMO_MIGRATION_TIMEOUT"); value != "" {
		var err error
		timeout, err = time.ParseDuration(value)
		if err != nil {
			return err
		}
	}
	ctx, stop := context.WithTimeout(parent, timeout)
	defer stop()
	url := os.Getenv("MNEMO_DATABASE_URL")
	// Hold the lock on a dedicated session for the complete Goose operation.
	lock, err := pgx.Connect(ctx, url)
	if err != nil {
		return err
	}
	defer lock.Close(context.Background())
	if _, err = lock.Exec(ctx, "SELECT pg_advisory_lock(714822)"); err != nil {
		return err
	}
	defer lock.Exec(context.Background(), "SELECT pg_advisory_unlock(714822)")
	db, err := sql.Open("pgx", url)
	if err != nil {
		return err
	}
	defer db.Close()
	db.SetMaxOpenConns(2)
	goose.SetBaseFS(migrations.FS)
	if err = goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.UpContext(ctx, db, ".")
}
