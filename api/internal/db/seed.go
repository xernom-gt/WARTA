package db

import (
	"context"
	_ "embed"
	"errors"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"warta.com/api/internal/user"
)

//go:embed seed_projects.sql
var seedProjectsSQL string

// SeedDevProjects inserts development projects when the projects table is empty.
func SeedDevProjects(ctx context.Context, pool *pgxpool.Pool) error {
	var count int64
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM projects`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		log.Printf("db: seed projects skipped, %d projects already present", count)
		return nil
	}
	if _, err := pool.Exec(ctx, seedProjectsSQL); err != nil {
		return err
	}
	log.Printf("db: seeded development projects")
	return nil
}

// SeedDevUsers inserts development citizens when the users table is empty.
// Passwords must already be hashed by the caller (password.Hash). It runs
// inside one transaction and never touches rows in a non-empty table, so it
// is a no-op against any environment that already has data (like
// database-design.md §9.1 rule 8: keep sample data out of migrations).
func SeedDevUsers(ctx context.Context, pool *pgxpool.Pool, users []user.User) error {
	var count int64
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		log.Printf("db: seed skipped, %d users already present", count)
		return nil
	}

	store := user.NewPGStore(pool)
	now := time.Now().UTC()
	for i := range users {
		u := users[i]
		if u.PasswordHash == "" {
			return errors.New("db: seed users must carry a password hash")
		}
		u.IsActive = true
		u.EmailVerifiedAt = &now
		if err := store.Create(ctx, &u); err != nil {
			return err
		}
	}
	log.Printf("db: seeded %d development users", len(users))
	return nil
}
