// WARTA API server: /health plus the /api/v1 contract. This milestone lands
// the auth foundation (TASK.md §Auth & User Profile):
//
//	POST /api/v1/auth/register   create an account (rate limited, 5/hour/IP)
//	POST /api/v1/auth/login      issue a JWT access token (10/minute/IP)
//	GET  /api/v1/auth/me         private profile behind Bearer verification
//
// Remaining auth endpoints (email verification, logout blocklist, /users/me)
// are adjacent tasks. Contracts: docs/api/openapi.yaml, §6.1-6.3 requirements.
package main

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"

	"warta.com/api/internal/auth"
	"warta.com/api/internal/config"
	"warta.com/api/internal/db"
	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/password"
	"warta.com/api/internal/token"
	"warta.com/api/internal/user"
)

// start anchors process uptime for /health (§14.5).
var start = time.Now()

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: connect: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("db: migrate: %v", err)
	}
	if cfg.Seed {
		if err := db.SeedDevUsers(ctx, pool, devSeedUsers()); err != nil {
			log.Fatalf("db: seed: %v", err)
		}
	}

	managers := wire(cfg, pool, user.NewPGStore(pool))
	log.Printf("warta api: listening on :%s (v%s)", cfg.Port, cfg.Version)
	if err := managers.app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("listen: %v", err)
	}
}

// wire assembles the full Fiber app; tests reuse it end to end. The store is
// injected so test suites can run the full stack against an in-memory store
// (the pool remains required by /health only).
func wire(cfg config.Config, pool *pgxpool.Pool, store user.Store) api {
	manager := token.NewManager(string(cfg.JWTSecret), cfg.JWTTTL)
	handlers := auth.NewHandler(store, manager)
	loginLimit := middleware.NewRateLimiter(cfg.LoginRateLimit, time.Minute)
	registerLimit := middleware.NewRateLimiter(cfg.RegisterRateLimit, time.Hour)

	app := fiber.New(fiber.Config{
		AppName:      "warta-api " + cfg.Version,
		ErrorHandler: renderError,
	})
	app.Use(recover.New()) // panics never leak stack traces (EnableStackTrace is false by default)
	app.Use(middleware.RequestID())

	app.Get("/api/v1/health", func(c fiber.Ctx) error {
		return health(c, pool, cfg)
	})

	v1 := app.Group("/api/v1")
	v1.Post("/auth/register", registerLimit.Middleware(), handlers.Register)
	v1.Post("/auth/login", loginLimit.Middleware(), handlers.Login)
	v1.Get("/auth/me", middleware.Bearer(manager), handlers.Me)

	return api{app: app}
}

// api bundles the pieces main needs after wiring.
type api struct {
	app *fiber.App
}

// devSeedUsers returns the three local dev citizens (TASK.md §Database) with
// one shared dev-only password. Never point production at WARTA_SEED=1.
func devSeedUsers() []user.User {
	const devPassword = "warta-dev-2026"
	hashed, err := password.Hash(devPassword)
	if err != nil {
		log.Printf("db: seed skipped, hash failure: %v", err)
		return nil
	}
	return []user.User{
		{DisplayName: "warga_jakarta", Email: "warga+1@example.com", PasswordHash: hashed},
		{DisplayName: "warga_barat", Email: "warga+2@example.com", PasswordHash: hashed},
		{DisplayName: "warga_utara", Email: "warga+3@example.com", PasswordHash: hashed},
	}
}

// health implements openapi.yaml /health (HealthResponse, bare object):
// 200 "ok" when the database responds, 503 "degraded" when it does not.
// storage is always "down" for now because object storage is a later
// milestone (§11); the contract's enum accepts it.
func health(c fiber.Ctx, pool *pgxpool.Pool, cfg config.Config) error {
	ctx, cancel := context.WithTimeout(c.Context(), 2*time.Second)
	defer cancel()

	dbStatus := "ok"
	if err := pool.Ping(ctx); err != nil {
		dbStatus = "down"
	}
	status := "ok"
	code := fiber.StatusOK
	if dbStatus != "ok" {
		status = "degraded"
		code = fiber.StatusServiceUnavailable
	}
	payload := fiber.Map{
		"status":         status,
		"database":       dbStatus,
		"storage":        "down",
		"version":        cfg.Version,
		"uptime_seconds": int64(time.Since(start).Seconds()),
	}
	return c.Status(code).JSON(payload)
}

// renderError is the global error surface (§4.1): every failure renders the
// error envelope; router 404s map onto not_found and anything unexpected
// onto internal_error. Never leaks SQL or stack traces (§4.5).
func renderError(c fiber.Ctx, err error) error {
	reqID := middleware.RequestIDOf(c)
	if reqID == "" {
		reqID = "generated-at-error"
	}
	c.Set(middleware.HeaderRequestID, reqID)

	var route *fiber.Error
	if errors.As(err, &route) {
		if route.Code == fiber.StatusNotFound || route.Code == fiber.StatusMethodNotAllowed {
			return httpx.Error(c, route.Code, "not_found", "Resource not found.")
		}
	}
	log.Printf("unhandled: request_id=%s method=%s path=%s err=%v", reqID, c.Method(), c.Path(), err)
	return httpx.Error(c, fiber.StatusInternalServerError,
		"internal_error", "An unexpected error occurred.")
}
