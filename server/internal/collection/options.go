package collection

import (
	"mnemo/server/internal/connection"
	"time"
)

// Options bound collection work independently of cluster size and DB outages.
type Options struct {
	AuthPolicy           connection.Policy
	MaxSnapshotResources int
	SnapshotTimeout      time.Duration
	TransactionTimeout   time.Duration
	ReconcileInterval    time.Duration
}

func (o Options) defaults() Options {
	if o.MaxSnapshotResources <= 0 {
		o.MaxSnapshotResources = 100000
	}
	if o.SnapshotTimeout <= 0 {
		o.SnapshotTimeout = 30 * time.Second
	}
	if o.TransactionTimeout <= 0 {
		o.TransactionTimeout = 15 * time.Second
	}
	if o.ReconcileInterval <= 0 {
		o.ReconcileInterval = 30 * time.Second
	}
	return o
}
