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

// SeedDevUsers inserts development citizens and admin accounts.
// Passwords must already be hashed by the caller (password.Hash). It checks
// each user by email and creates any missing users, making it idempotent and
// safe across migrations and dev restarts.
func SeedDevUsers(ctx context.Context, pool *pgxpool.Pool, users []user.User) error {
	store := user.NewPGStore(pool)
	now := time.Now().UTC()
	for i := range users {
		u := users[i]
		if u.PasswordHash == "" {
			return errors.New("db: seed users must carry a password hash")
		}
		existing, err := store.FindByEmail(ctx, u.Email)
		if err == nil && existing != nil {
			continue
		}
		if err != nil && !errors.Is(err, user.ErrNotFound) {
			return err
		}
		u.IsActive = true
		u.EmailVerifiedAt = &now
		if err := store.Create(ctx, &u); err != nil {
			return err
		}
		log.Printf("db: seeded development user %s (%s)", u.Email, u.Role)
	}
	return nil
}
