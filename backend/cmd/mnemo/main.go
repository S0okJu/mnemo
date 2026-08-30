// Command mnemo serves mnemo's REST API over the local data directory.
package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/S0okJu/mnemo/backend/internal/httpapi"
	"github.com/S0okJu/mnemo/backend/internal/profile"
	"github.com/S0okJu/mnemo/backend/internal/workspace"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	dataDir := os.Getenv("MNEMO_DATA_DIR")
	if dataDir == "" {
		wd, err := os.Getwd()
		if err != nil {
			return err
		}
		dataDir = filepath.Join(wd, "mnemo-data")
	}

	profiles := profile.NewManager(dataDir)
	if err := profiles.Bootstrap(); err != nil {
		return err
	}
	docs := workspace.NewManager(profiles.WorkspaceDir(profile.UserProfileName))

	addr := os.Getenv("MNEMO_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	mux := httpapi.NewRouter(profiles, docs)
	log.Printf("mnemo listening on %s (data dir %s)", addr, dataDir)
	return http.ListenAndServe(addr, mux)
}
