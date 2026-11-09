// WARTA API server: /health plus the /api/v1 contract. This milestone lands
// the auth foundation plus email verification (TASK.md §Auth & User Profile):
//
//	POST /api/v1/auth/register             create an account (5/hour/IP)
//	                                       + sends the verification email
//	POST /api/v1/auth/login                issue a JWT access token (10/min/IP)
//	POST /api/v1/auth/verify-email         consume the mailed single-use token
//	POST /api/v1/auth/resend-verification  re-issue + re-send (3/hour/account)
//	GET  /api/v1/auth/me                   private profile behind Bearer
//
// Remaining auth endpoints (logout blocklist, /users/me family) are adjacent
// tasks. Contracts: docs/api/openapi.yaml, §6.1-6.3, §6.20-6.21 requirements.
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
	"warta.com/api/internal/authtoken"
	"warta.com/api/internal/blocklist"
	"warta.com/api/internal/claim"
	"warta.com/api/internal/config"
	"warta.com/api/internal/db"
	"warta.com/api/internal/httpx"
	"warta.com/api/internal/mailer"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/password"
	"warta.com/api/internal/report"
	"warta.com/api/internal/token"
	"warta.com/api/internal/user"
	"warta.com/api/internal/verification"
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
	tokens := authtoken.NewPGStore(pool)
	bl := blocklist.NewMemStore()
	mail := chooseMailer(cfg)
	resendLimit := middleware.NewRateLimiter(cfg.ResendRateLimit, time.Hour)

	handlers := auth.NewHandler(auth.Deps{
		Store:      store,
		Manager:    manager,
		Tokens:     tokens,
		Blocklist:  bl,
		Mail:       mail,
		MailFrom:   cfg.MailFrom,
		VerifyBase: cfg.MailVerifyBaseURL,
	})
	userHandlers := user.NewHandler(user.Deps{
		Store:       store,
		ReportStore: report.NewPGStore(pool),
		ClaimStore:  claim.NewPGStore(pool),
		VoteStore:   verification.NewPGVoteStore(pool),
	})
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
	v1.Post("/auth/verify-email", handlers.VerifyEmail)
	// §6.21 rate limiting is per account, so the identity middleware must
	// run before the limiter: the key is the bearer-verified user id.
	v1.Post("/auth/resend-verification",
		middleware.Bearer(manager, bl),
		resendLimit.MiddlewareForKey(func(c fiber.Ctx) string {
			id, _ := c.Locals(middleware.LocalUserID).(string)
			return id
		}),
		handlers.ResendVerification)
	v1.Get("/auth/me", middleware.Bearer(manager, bl), handlers.Me)
	v1.Post("/auth/logout", middleware.Bearer(manager, bl), handlers.Logout)
	v1.Patch("/users/me", middleware.Bearer(manager, bl), userHandlers.UpdateMe)
	v1.Delete("/users/me", middleware.Bearer(manager, bl), userHandlers.DeleteMe)
	// §6.x: the /users/me family is the caller's own view — "me" is a
	// reserved alias (api-guidelines §5), so it never routes to :user_id.
	v1.Get("/users/me/reports", middleware.Bearer(manager, bl), userHandlers.ListMyReports)
	v1.Get("/users/me/claims", middleware.Bearer(manager, bl), userHandlers.ListMyClaims)
	v1.Get("/users/me/votes", middleware.Bearer(manager, bl), userHandlers.ListMyVotes)
	// §6.4: public, no bearer. Deactivated profiles still return 200 with
	// is_active=false (§7.4 keeps is_active in the public shape).
	v1.Get("/users/:user_id", userHandlers.GetPublicUser)

return api{app: app}
}

// chooseMailer selects the delivery transport (§3.5): SMTP when a host is
// configured, the log-printing console transport otherwise. The choice is
// logged once so a dev stack never silently pretends to deliver mail.
func chooseMailer(cfg config.Config) mailer.Service {
	if cfg.SMTPHost == "" {
		log.Print("warta api: mail via console (SMTP_HOST unset; verification links print to the log)")
		return mailer.Console{}
	}
	log.Printf("warta api: mail via smtp %s:%d", cfg.SMTPHost, cfg.SMTPPort)
	return mailer.NewSMTP(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUsername, cfg.SMTPPassword)
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
