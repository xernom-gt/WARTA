package db

import (
	"strings"
	"testing"
)

func TestLoadMigrations_PairsAndOrdering(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatalf("loadMigrations failed: %v", err)
	}

	if len(migrations) < 10 {
		t.Fatalf("expected at least 10 migrations, got %d", len(migrations))
	}

	for i, m := range migrations {
		expectedVersion := i + 1
		if m.version != expectedVersion {
			t.Errorf("migration index %d expected version %d, got %d (_%s)", i, expectedVersion, m.version, m.name)
		}
		if strings.TrimSpace(m.up) == "" {
			t.Errorf("migration %06d_%s has empty .up.sql", m.version, m.name)
		}
		if strings.TrimSpace(m.down) == "" {
			t.Errorf("migration %06d_%s has empty .down.sql", m.version, m.name)
		}
	}
}
