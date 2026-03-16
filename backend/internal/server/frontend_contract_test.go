package server_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"improve-platform/internal/config"
	"improve-platform/internal/server"
)

func newTestServer() http.Handler {
	cfg := &config.Config{
		Port:      8080,
		JWTSecret: "test-secret",
	}
	return server.New(cfg, nil, slog.Default()).Router()
}

func TestFrontendAuthRoutes_RegisteredInBackend(t *testing.T) {
	router := newTestServer()

	cases := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{
			name:       "register route exists",
			method:     http.MethodGet,
			path:       "/api/v1/auth/register",
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "login route exists",
			method:     http.MethodGet,
			path:       "/api/v1/auth/login",
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "refresh route exists",
			method:     http.MethodGet,
			path:       "/api/v1/auth/refresh",
			wantStatus: http.StatusMethodNotAllowed,
		},
		{
			name:       "logout route exists",
			method:     http.MethodGet,
			path:       "/api/v1/auth/logout",
			wantStatus: http.StatusMethodNotAllowed,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("expected %d, got %d", tc.wantStatus, rec.Code)
			}
		})
	}
}

func TestFrontendProtectedRoutes_RequireAuthorization(t *testing.T) {
	router := newTestServer()

	cases := []struct {
		name string
		path string
	}{
		{name: "me", path: "/api/v1/me"},
		{name: "roadmap", path: "/api/v1/roadmap"},
		{name: "tasks", path: "/api/v1/tasks"},
		{name: "materials", path: "/api/v1/materials/mat-1"},
		{name: "history", path: "/api/v1/history"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected %d, got %d", http.StatusUnauthorized, rec.Code)
			}
		})
	}
}
