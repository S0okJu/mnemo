package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"mnemo/server/internal/collection"
	"mnemo/server/internal/connection"
	"mnemo/server/internal/httpapi"
	"net/http/httputil"
	"net/url"
)

func main() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}
func required(name string) (string, error) {
	value := os.Getenv(name)
	if value == "" {
		return "", errors.New(name + " is required")
	}
	return value, nil
}
func run() error {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	dbURL, err := required("MNEMO_DATABASE_URL")
	if err != nil {
		return err
	}
	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return errors.New("invalid database configuration")
	}
	max := int64(10)
	if raw := os.Getenv("MNEMO_DB_MAX_CONNECTIONS"); raw != "" {
		max, err = strconv.ParseInt(raw, 10, 32)
		if err != nil || max < 1 || max > 100 {
			return errors.New("database pool limit must be 1..100")
		}
	}
	config.MaxConns = int32(max)
	config.MinConns = 0
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute
	config.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return errors.New("could not initialize database pool")
	}
	defer pool.Close()
	vault, err := connection.NewVault(os.Getenv("MNEMO_ENCRYPTION_KEY"))
	if err != nil {
		return err
	}
	caFile, err := required("MNEMO_CLIENT_CA_FILE")
	if err != nil {
		return err
	}
	ca, err := os.ReadFile(caFile)
	if err != nil {
		return errors.New("could not read client CA")
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(ca) {
		return errors.New("invalid client CA")
	}
	certFile, err := required("MNEMO_TLS_CERT_FILE")
	if err != nil {
		return err
	}
	keyFile, err := required("MNEMO_TLS_KEY_FILE")
	if err != nil {
		return err
	}
	store := &connection.Store{Pool: pool, Vault: vault}
	snapshotLimit, err := positiveEnv("MNEMO_COLLECTION_MAX_RESOURCES", 100000, 1000000)
	if err != nil {
		return err
	}
	reconcileSeconds, err := positiveEnv("MNEMO_COLLECTION_INTERVAL_SECONDS", 30, 3600)
	if err != nil {
		return err
	}
	heartbeatSeconds, err := positiveEnv("MNEMO_SSE_HEARTBEAT_SECONDS", 15, 300)
	if err != nil {
		return err
	}
	queueSize, err := positiveEnv("MNEMO_SSE_QUEUE_SIZE", 1, 64)
	if err != nil {
		return err
	}
	maxSubscribers, err := positiveEnv("MNEMO_SSE_MAX_SUBSCRIBERS", 256, 10000)
	if err != nil {
		return err
	}
	authPolicy := connection.Policy{RequireTLSVerify: os.Getenv("MNEMO_REQUIRE_TLS_VERIFY") == "true", AllowExec: os.Getenv("MNEMO_ALLOW_EXEC_AUTH") == "true", ExecAllowlist: strings.Split(os.Getenv("MNEMO_EXEC_ALLOWLIST"), ","), ExecEnvAllowlist: strings.Split(os.Getenv("MNEMO_EXEC_ENV_ALLOWLIST"), ",")}
	events := &httpapi.Events{Heartbeat: time.Duration(heartbeatSeconds) * time.Second, QueueSize: queueSize, MaxSubscribers: maxSubscribers}
	collectorDone := make(chan struct{})
	go func() {
		defer close(collectorDone)
		collection.ManageWithOptions(ctx, store, events.Notify, collection.Options{AuthPolicy: authPolicy, MaxSnapshotResources: snapshotLimit, ReconcileInterval: time.Duration(reconcileSeconds) * time.Second})
	}()
	defer func() { cancel(); <-collectorDone }()
	go collection.Maintain(ctx, pool)
	allowHTTP := os.Getenv("MNEMO_ALLOW_HTTP") == "true"
	identify := httpapi.Identify(httpapi.CertificateIdentity)

	if allowHTTP {
		if os.Getenv("MNEMO_HTTP_NO_AUTH") == "true" {
			identify = func(r *http.Request) (httpapi.Identity, bool) {
				if r.TLS == nil {
					return httpapi.Identity{User: "test-environment", Admin: true}, true
				}
				return httpapi.CertificateIdentity(r)
			}
		} else {
			admin, viewer := os.Getenv("MNEMO_HTTP_ADMIN_PASSWORD"), os.Getenv("MNEMO_HTTP_VIEWER_PASSWORD")
			if len(admin) < 16 || len(viewer) < 16 {
				return errors.New("HTTP authenticated mode requires strong passwords")
			}
			identify = httpapi.BasicIdentity(admin, viewer)
		}
	}
	api := &httpapi.API{AllowHTTP: allowHTTP, AllowKubeconfigOverride: os.Getenv("MNEMO_ALLOW_KUBECONFIG_OVERRIDE") == "true", Events: events, Store: store, Policy: authPolicy, Identify: identify, CSRF: httpapi.CheckCSRF}
	bootstrapPath := os.Getenv("MNEMO_BOOTSTRAP_KUBECONFIG")
	if bootstrapPath == "" {
		bootstrapPath = "./config"
		if _, err := os.Stat(bootstrapPath); os.IsNotExist(err) {
			if _, e := os.Stat("../config"); e == nil {
				bootstrapPath = "../config"
			}
		}
	}
	initializerDone := make(chan struct{})
	go func() {
		defer close(initializerDone)
		reported := false
		collection.Initialize(ctx, store, bootstrapPath, api.Policy, func(failed bool) {
			if failed && !reported {
				log.Print("initial connection unavailable; retrying without replacing stored settings")
			}
			reported = failed
		})
	}()
	defer func() { cancel(); <-initializerDone }()

	mux := http.NewServeMux()
	mux.Handle("/api/v1/", api.Handler())
	mux.HandleFunc("GET /api/v1/session", httpapi.SessionWithIdentity(identify))
	mux.HandleFunc("GET /livez", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		probe, c := context.WithTimeout(r.Context(), 3*time.Second)
		defer c()
		var version int64
		if pool.QueryRow(probe, "SELECT version_id FROM goose_db_version WHERE is_applied ORDER BY id DESC LIMIT 1").Scan(&version) != nil || version != 1 {
			w.WriteHeader(503)
			return
		}
		w.WriteHeader(200)
	})
	if frontend := os.Getenv("MNEMO_FRONTEND_URL"); frontend != "" {
		upstream, e := url.Parse(frontend)
		if e != nil || upstream.Host == "" {
			return errors.New("invalid frontend URL")
		}
		proxy := httputil.NewSingleHostReverseProxy(upstream)
		director := proxy.Director
		proxy.Director = func(r *http.Request) { director(r); r.Header.Del("Authorization"); r.Header.Del("X-CSRF-Token") }
		proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, e error) { http.Error(w, "Frontend unavailable", 502) }
		mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if _, ok := identify(r); !ok {
				if allowHTTP {
					w.Header().Set("WWW-Authenticate", `Basic realm="mnemo"`)
				}
				http.Error(w, "Authentication required", 401)
				return
			}
			proxy.ServeHTTP(w, r)
		}))
	}
	address := os.Getenv("MNEMO_LISTEN")
	if address == "" {
		address = ":8443"
	}
	server := &http.Server{BaseContext: func(net.Listener) context.Context { return ctx }, Addr: address, Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10, TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12, ClientCAs: roots, ClientAuth: tls.VerifyClientCertIfGiven}}
	var plain *http.Server
	result := make(chan error, 2)
	if allowHTTP {
		httpAddress := os.Getenv("MNEMO_HTTP_LISTEN")
		if httpAddress == "" {
			httpAddress = ":8080"
		}
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/livez" && r.URL.Path != "/readyz" {
				if _, ok := identify(r); !ok {
					w.Header().Set("WWW-Authenticate", `Basic realm="mnemo"`)
					http.Error(w, "Authentication required", 401)
					return
				}
			}
			mux.ServeHTTP(w, r)
		})
		plain = &http.Server{Addr: httpAddress, Handler: handler, BaseContext: func(net.Listener) context.Context { return ctx }, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10}
		go func() { result <- plain.ListenAndServe() }()
	}
	go func() { result <- server.ListenAndServeTLS(certFile, keyFile) }()
	defer server.Close()
	if plain != nil {
		defer plain.Close()
	}
	select {
	case err = <-result:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return errors.New("HTTP(S) listener failed")
	case <-ctx.Done():
		shutdown, c := context.WithTimeout(context.Background(), 15*time.Second)
		defer c()
		if plain != nil {
			_ = plain.Shutdown(shutdown)
		}
		return server.Shutdown(shutdown)
	}
}

func positiveEnv(name string, fallback, max int) (int, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 || value > max {
		return 0, errors.New("invalid " + name)
	}
	return value, nil
}
