package server_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/singl3focus/improve-platform/internal/config"
	"github.com/singl3focus/improve-platform/internal/server"
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
		{name: "roadmaps", path: "/api/v1/roadmaps"},
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

func TestFrontendRoadmapStageRoutes_Removed(t *testing.T) {
	router := newTestServer()

	cases := []struct {
		name   string
		method string
		path   string
	}{
		{name: "stages list removed", method: http.MethodGet, path: "/api/v1/roadmap/stages"},
		{name: "stages create removed", method: http.MethodPost, path: "/api/v1/roadmap/stages"},
		{name: "stage by id removed", method: http.MethodGet, path: "/api/v1/roadmap/stages/11111111-1111-1111-1111-111111111111"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusNotFound {
				t.Fatalf("expected %d, got %d", http.StatusNotFound, rec.Code)
			}
		})
	}
}
