// Package config loads the API configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config carries every runtime setting the API needs. Values are read once on
// startup; missing required values fail fast with a clear message (§13.5).
type Config struct {
	// Port the Fiber server listens on.
	Port string

	// DatabaseURL is the PostgreSQL connection string (pgx format).
	DatabaseURL string

	// JWTSecret is the HMAC secret for HS256 token signing.
	JWTSecret []byte

	// JWTTTL is the access token lifetime (3600s by default, §3.1).
	JWTTTL time.Duration

	// LoginRateLimit is the max login requests per minute per IP (§13.4: 10).
	LoginRateLimit int64

	// RegisterRateLimit is the max register requests per hour per IP (§13.4: 5).
	RegisterRateLimit int64

	// ResendRateLimit is the max resend-verification requests per hour per
	// account (§6.21: 3).
	ResendRateLimit int64

	// SMTP delivery (§3.5). SMTPHost empty selects the console transport,
	// which prints every outgoing mail into the server log for local dev.
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string

	// MailFrom is the RFC 5322 From header of transactional mail, e.g.
	// `WARTA <no-reply@warta.id>`.
	MailFrom string

	// MailVerifyBaseURL is the frontend page that consumes the token; the
	// mailed link is BASE?token=<raw> (§6.20).
	MailVerifyBaseURL string

	// Object storage (S3/R2/MinIO) (§11.1).
	StorageDriver    string
	S3Endpoint       string
	S3Region         string
	S3Bucket         string
	S3AccessKeyID    string
	S3SecretKey      string
	S3PublicURL      string
	S3ForcePathStyle bool

	// Seed toggles dev seed data when the users table is empty.
	Seed bool

	// Version is reported by /health for observability (§14.5).
	Version string
}

const (
	defaultPort          = "3000"
	defaultDatabaseURL   = "postgres://warta:warta@localhost:5435/warta?sslmode=disable"
	defaultJWTTTLSeconds = 3600
	defaultLoginRate     = 10
	defaultRegisterRate  = 5
	defaultResendRate    = 3
	defaultSMTPPort      = 587
	defaultMailFrom      = "WARTA <no-reply@warta.id>"
	defaultVerifyBaseURL = "http://localhost:5173/verify-email"
)

var errEnv = "config: %s must be a positive integer, got %q"

// Load reads the environment and returns a validated Config.
func Load() (Config, error) {
	port, ok := os.LookupEnv("API_PORT")
	if !ok || port == "" {
		port = defaultPort
	}

	ttl, err := seconds("JWT_TTL_SECONDS", defaultJWTTTLSeconds)
	if err != nil {
		return Config{}, err
	}
	login, err := positiveInt("LOGIN_RATE_LIMIT", defaultLoginRate)
	if err != nil {
		return Config{}, err
	}
	register, err := positiveInt("REGISTER_RATE_LIMIT", defaultRegisterRate)
	if err != nil {
		return Config{}, err
	}
	resend, err := positiveInt("RESEND_RATE_LIMIT", defaultResendRate)
	if err != nil {
		return Config{}, err
	}
	smtpPort, err := positiveInt("SMTP_PORT", defaultSMTPPort)
	if err != nil {
		return Config{}, err
	}

	cfg := Config{
		Port:              port,
		DatabaseURL:       value("DATABASE_URL", defaultDatabaseURL),
		JWTTTL:            ttl,
		LoginRateLimit:    login,
		RegisterRateLimit: register,
		ResendRateLimit:   resend,
		SMTPPort:          int(smtpPort),
		MailFrom:          value("MAIL_FROM", defaultMailFrom),
		MailVerifyBaseURL: value("MAIL_VERIFY_BASE_URL", defaultVerifyBaseURL),
		StorageDriver:    value("STORAGE_DRIVER", "memory"),
		S3Endpoint:       os.Getenv("S3_ENDPOINT"),
		S3Region:         value("S3_REGION", "us-east-1"),
		S3Bucket:         os.Getenv("S3_BUCKET"),
		S3AccessKeyID:    os.Getenv("S3_ACCESS_KEY_ID"),
		S3SecretKey:      os.Getenv("S3_SECRET_ACCESS_KEY"),
		S3PublicURL:      os.Getenv("S3_PUBLIC_URL"),
		S3ForcePathStyle: os.Getenv("S3_FORCE_PATH_STYLE") == "1" || os.Getenv("S3_FORCE_PATH_STYLE") == "true",
		Seed:              os.Getenv("WARTA_SEED") == "1",
		Version:           "0.1.0",
	}

	// SMTP host is optional: empty selects the console transport. The other
	// SMTP values are only meaningful together with a host.
	cfg.SMTPHost = os.Getenv("SMTP_HOST")
	cfg.SMTPUsername = os.Getenv("SMTP_USERNAME")
	cfg.SMTPPassword = os.Getenv("SMTP_PASSWORD")

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return cfg, fmt.Errorf("config: JWT_SECRET is required (see .env.example)")
	}
	cfg.JWTSecret = []byte(secret)

	return cfg, nil
}

func value(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

// seconds parses a positive integer of seconds into a duration,
// falling back when unset and failing when set to an invalid value.
func seconds(key string, fallback int64) (time.Duration, error) {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return time.Duration(fallback) * time.Second, nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf(errEnv, key, v)
	}
	return time.Duration(n) * time.Second, nil
}

// positiveInt parses a positive integer, falling back when unset.
func positiveInt(key string, fallback int64) (int64, error) {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback, nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf(errEnv, key, v)
	}
	return n, nil
}
