package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
	"warta.com/api/internal/config"
)

type mockPool struct {
	pingErr error
}

func (m *mockPool) Ping(ctx context.Context) error {
	return m.pingErr
}

type mockStorage struct {
	pingErr error
}

func (m *mockStorage) Ping(ctx context.Context) error {
	return m.pingErr
}

func (m *mockStorage) Put(ctx context.Context, key string, contentType string, data []byte) (string, error) {
	return "", nil
}

func (m *mockStorage) Delete(ctx context.Context, fileURL string) error {
	return nil
}

func TestHealth_AllUp(t *testing.T) {
	app := fiber.New()
	pool := &mockPool{}
	storage := &mockStorage{}
	cfg := config.Config{Version: "1.0.0-test"}

	app.Get("/api/v1/health", func(c fiber.Ctx) error {
		return health(c, pool, storage, cfg)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("status = %d; want 200", resp.StatusCode)
	}

	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)

	if body["status"] != "ok" {
		t.Errorf("status = %v; want ok", body["status"])
	}
	if body["database"] != "ok" {
		t.Errorf("database = %v; want ok", body["database"])
	}
	if body["storage"] != "ok" {
		t.Errorf("storage = %v; want ok", body["storage"])
	}
	if body["version"] != "1.0.0-test" {
		t.Errorf("version = %v; want 1.0.0-test", body["version"])
	}
}

func TestHealth_DBDown(t *testing.T) {
	app := fiber.New()
	pool := &mockPool{pingErr: errors.New("connection refused")}
	storage := &mockStorage{}
	cfg := config.Config{Version: "1.0.0-test"}

	app.Get("/api/v1/health", func(c fiber.Ctx) error {
		return health(c, pool, storage, cfg)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 503 {
		t.Errorf("status = %d; want 503", resp.StatusCode)
	}

	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)

	if body["status"] != "degraded" {
		t.Errorf("status = %v; want degraded", body["status"])
	}
	if body["database"] != "down" {
		t.Errorf("database = %v; want down", body["database"])
	}
}

func TestHealth_StorageDown(t *testing.T) {
	app := fiber.New()
	pool := &mockPool{}
	storage := &mockStorage{pingErr: errors.New("s3 unavailable")}
	cfg := config.Config{Version: "1.0.0-test"}

	app.Get("/api/v1/health", func(c fiber.Ctx) error {
		return health(c, pool, storage, cfg)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 503 {
		t.Errorf("status = %d; want 503", resp.StatusCode)
	}

	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)

	if body["status"] != "degraded" {
		t.Errorf("status = %v; want degraded", body["status"])
	}
	if body["storage"] != "down" {
		t.Errorf("storage = %v; want down", body["storage"])
	}
}
