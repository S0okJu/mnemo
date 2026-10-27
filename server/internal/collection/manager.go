package collection

import (
	"context"
	"errors"
	"os"
	"time"

	"k8s.io/client-go/rest"
	"mnemo/server/internal/connection"
)

// Manage cancels and joins collectors before starting a new generation. Database
// row locks additionally fence in-flight writes during the polling interval.
func Manage(ctx context.Context, store *connection.Store, notify func()) {
	ManageWithOptions(ctx, store, notify, Options{})
}
func ManageWithOptions(ctx context.Context, store *connection.Store, notify func(), options Options) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	var current int64 = -1
	var cancel context.CancelFunc
	var done chan struct{}
	stop := func() {
		if cancel != nil {
			cancel()
			<-done
			cancel = nil
		}
	}
	defer stop()
	for {
		if cancel != nil {
			select {
			case <-done:
				cancel()
				cancel = nil
				current = -1
			default:
			}
		}
		loadCtx, loadCancel := context.WithTimeout(ctx, 5*time.Second)
		metadata, plain, generation, err := store.Load(loadCtx)
		loadCancel()
		if err == nil && generation != current {
			stop()
			current = generation
			if metadata.Configured {
				var config *rest.Config
				var e error
				if metadata.Source == "in-cluster" {
					config, e = rest.InClusterConfig()
				} else {
					config, e = connection.ControlledRESTConfig(plain, options.AuthPolicy)
				}
				if e == nil {
					config.Timeout = 10 * time.Second
					// stop() owns workerCancel through cancel, including the deferred call on return.
					worker, workerCancel := context.WithCancel(ctx)
					cancel = workerCancel
					finished := make(chan struct{})
					done = finished
					go func() {
						defer close(finished)
						_ = RunWithOptions(worker, store.Pool, config, generation, notify, options)
					}()
				} else {
					current = -1
				}
			}
			if notify != nil {
				notify()
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func InClusterFallback(ctx context.Context, store *connection.Store) error {
	_, _, generation, err := store.Load(ctx)
	if err != nil || generation != 0 {
		return err
	}
	metadata, err := connection.ProbeInCluster(ctx, connection.Policy{})
	if err != nil {
		return nil
	}
	_, err = store.Initialize(ctx, metadata, nil, "in-cluster")
	return err
}

// Bootstrap only initializes a database with no connection record. A persisted
// disconnect tombstone prevents credentials from unexpectedly reappearing.
func Bootstrap(ctx context.Context, store *connection.Store, path string, policy connection.Policy) error {
	_, _, generation, err := store.Load(ctx)
	if err != nil {
		return err
	}
	if generation != 0 {
		return nil
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	validation, metadata, minified, _, _ := connection.Validate(ctx, connection.Submission{Kubeconfig: string(data)}, policy)
	if !validation.OK {
		return errors.New("bootstrap connection failed validation")
	}
	_, err = store.Initialize(ctx, metadata, minified, "bootstrap")
	return err
}

// Initialize retries startup after schema/DB/cluster outages without preventing
// Settings from being served. The callback receives only a redacted condition.
func Initialize(ctx context.Context, store *connection.Store, path string, policy connection.Policy, report func(bool)) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		attempt, cancel := context.WithTimeout(ctx, 15*time.Second)
		_, _, generation, err := store.Load(attempt)
		if err == nil && generation != 0 {
			cancel()
			if report != nil {
				report(false)
			}
			return
		}
		if err == nil {
			err = Bootstrap(attempt, store, path, policy)
		}
		if err == nil {
			err = InClusterFallback(attempt, store)
		}
		cancel()
		if report != nil {
			report(err != nil)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
