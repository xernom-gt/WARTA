package db

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// migration is one versioned change with a forward and a rollback step
// (database-design.md §9.1).
type migration struct {
	version int
	name    string
	up      string
	down    string
}

// loadMigrations parses the embedded .up/.down files, pairing them per
// version and refusing incomplete pairs.
func loadMigrations() ([]migration, error) {
	pairs := map[int]*migration{}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		name := entry.Name()
		versionStr, rest, ok := strings.Cut(name, "_")
		if !ok {
			return nil, fmt.Errorf("db: migration file %q does not follow <version>_<name>.<up|down>.sql", name)
		}
		version, err := strconv.Atoi(versionStr)
		if err != nil {
			return nil, fmt.Errorf("db: migration file %q has an unparsable version", name)
		}
		body, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return nil, err
		}
		m := pairs[version]
		if m == nil {
			m = &migration{version: version}
			pairs[version] = m
		}
		switch {
		case strings.HasSuffix(name, ".up.sql"):
			m.up = string(body)
			m.name = strings.TrimSuffix(rest, ".up.sql")
		case strings.HasSuffix(name, ".down.sql"):
			m.down = string(body)
			m.name = strings.TrimSuffix(rest, ".down.sql")
		default:
			return nil, fmt.Errorf("db: migration file %q must end in .up.sql or .down.sql", name)
		}
	}
	out := make([]migration, 0, len(pairs))
	for _, m := range pairs {
		if m.up == "" || m.down == "" {
			return nil, fmt.Errorf("db: migration %04d (_%s) is missing its .up or .down file", m.version, m.name)
		}
		out = append(out, *m)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].version < out[j].version })
	return out, nil
}

// Migrate applies every pending migration in version order, each in its own
// transaction, recording versions in schema_migrations. It is idempotent.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    BIGINT     PRIMARY KEY,
			name       TEXT       NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`); err != nil {
		return err
	}

	var current int64
	if err := pool.QueryRow(ctx,
		`SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&current); err != nil {
		return err
	}

	pending, err := loadMigrations()
	if err != nil {
		return err
	}
	for _, m := range pending {
		if int64(m.version) <= current {
			continue
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, m.up); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("db: migration %04d_%s failed: %w", m.version, m.name, err)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`,
			m.version, m.name); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		log.Printf("db: applied migration %04d_%s", m.version, m.name)
	}
	return nil
}
