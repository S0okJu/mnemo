// Command mnemo bootstraps mnemo's local data directory. The HTTP API is
// added in a later sub-task.
package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/S0okJu/mnemo/backend/internal/profile"
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

	log.Printf("mnemo data directory ready at %s", dataDir)
	return nil
}
