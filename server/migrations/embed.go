package migrations

import "embed"

// FS contains versioned Goose migrations shipped with both API and migration images.
//
//go:embed *.sql
var FS embed.FS
