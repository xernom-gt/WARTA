package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"warta.com/api/internal/config"
	"warta.com/api/internal/token"
	"warta.com/api/internal/user"
)

func TestAdminRoutes_RBAC(t *testing.T) {
	userStore := user.NewMemoryStore()

	adminUser := userStore.MustAdd(user.User{
		DisplayName: "admin_dinas",
		Email:       "admin@dinas.pupr.go.id",
		Role:        "admin",
		IsActive:    true,
	})

	citizenUser := userStore.MustAdd(user.User{
		DisplayName: "warga_biasa",
		Email:       "warga@example.com",
		Role:        "warga",
		IsActive:    true,
	})

	cfg := config.Config{
		Version:           "1.0.0-test",
		JWTSecret:         []byte("test-secret-at-least-32-bytes-long!"),
		JWTTTL:            time.Hour,
		LoginRateLimit:    100,
		RegisterRateLimit: 100,
		ResendRateLimit:   100,
	}

	appBundle := wire(cfg, nil, userStore)
	app := appBundle.app

	tm := token.NewManager(string(cfg.JWTSecret), cfg.JWTTTL)
	citizenToken, _ := tm.Issue(citizenUser.ID)
	_ = adminUser

	projectPayload := `{
		"title": "Proyek Jembatan Baru",
		"satker": "Dinas Bina Marga",
		"category": "Jalan & Jembatan",
		"pagu_amount": "10000000000.00",
		"city": "Jakarta Pusat",
		"address": "Jl. MH Thamrin"
	}`

	// 1. Citizen attempts POST /api/v1/projects -> Expect 403 Forbidden
	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects", strings.NewReader(projectPayload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+citizenToken)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("citizen request failed: %v", err)
	}
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("citizen expected 403 Forbidden, got %d", resp.StatusCode)
	}

	// 2. Unauthenticated request -> Expect 401 Unauthorized
	reqUnauth := httptest.NewRequest(http.MethodPost, "/api/v1/projects", strings.NewReader(projectPayload))
	reqUnauth.Header.Set("Content-Type", "application/json")
	respUnauth, err := app.Test(reqUnauth)
	if err != nil {
		t.Fatalf("unauth request failed: %v", err)
	}
	if respUnauth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauth expected 401 Unauthorized, got %d", respUnauth.StatusCode)
	}
}

func TestAdminChecker_ActiveAndRole(t *testing.T) {
	userStore := user.NewMemoryStore()

	adminUser := userStore.MustAdd(user.User{
		DisplayName: "admin_dinas",
		Email:       "admin@dinas.pupr.go.id",
		Role:        "admin",
		IsActive:    true,
	})

	inactiveAdmin := userStore.MustAdd(user.User{
		DisplayName: "admin_pasif",
		Email:       "pasif@dinas.pupr.go.id",
		Role:        "admin",
		IsActive:    false,
	})

	checker := &adminChecker{store: userStore}
	ctx := context.Background()

	active, isAdmin, err := checker.CheckAdmin(ctx, adminUser.ID)
	if err != nil || !active || !isAdmin {
		t.Fatalf("expected active admin, got active=%v, isAdmin=%v, err=%v", active, isAdmin, err)
	}

	active, isAdmin, err = checker.CheckAdmin(ctx, inactiveAdmin.ID)
	if err != nil || active || !isAdmin {
		t.Fatalf("expected inactive admin, got active=%v, isAdmin=%v", active, isAdmin)
	}
}
