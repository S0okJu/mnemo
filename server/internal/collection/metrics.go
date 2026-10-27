package collection

import (
	"fmt"
	"io"
	"sync"
	"sync/atomic"
	"time"
)

var queueDepth atomic.Int64
var coalesced atomic.Uint64
var kindMetrics sync.Map

type sample struct {
	attempts       atomic.Uint64
	failures       atomic.Uint64
	nanoseconds    atomic.Int64
	lastCommit     atomic.Int64
	lagNanoseconds atomic.Int64
}

func observe(kind string, start time.Time, err error) {
	value, _ := kindMetrics.LoadOrStore(kind, &sample{})
	m := value.(*sample)
	elapsed := time.Since(start)
	m.attempts.Add(1)
	m.nanoseconds.Add(int64(elapsed))
	if err != nil {
		m.failures.Add(1)
	} else {
		m.lastCommit.Store(time.Now().Unix())
		m.lagNanoseconds.Store(int64(elapsed))
	}
}

// WriteMetrics exports bounded kind labels; it never labels resources, users,
// kubeconfig fields, server URLs, error text or credentials.
func WriteMetrics(w io.Writer) {
	fmt.Fprintf(w, "mnemo_collection_queue_depth %d\nmnemo_collection_coalesced_total %d\n", queueDepth.Load(), coalesced.Load())
	kindMetrics.Range(func(key, value any) bool {
		kind := key.(string)
		m := value.(*sample)
		fmt.Fprintf(w, "mnemo_collection_attempts_total{kind=%q} %d\nmnemo_collection_failures_total{kind=%q} %d\nmnemo_collection_duration_seconds_sum{kind=%q} %g\nmnemo_collection_last_commit_timestamp_seconds{kind=%q} %d\nmnemo_collection_to_commit_lag_seconds{kind=%q} %g\n", kind, m.attempts.Load(), kind, m.failures.Load(), kind, float64(m.nanoseconds.Load())/1e9, kind, m.lastCommit.Load(), kind, float64(m.lagNanoseconds.Load())/1e9)
		return true
	})
}
