package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"improve-platform/internal/auth"
)

const testJWTSecret = "test-jwt-secret"

func makeToken(t *testing.T, secret string, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return s
}

func TestMiddleware_ValidToken(t *testing.T) {
	tok := makeToken(t, testJWTSecret, jwt.MapClaims{
		"sub": "uuid-1",
		"typ": "access",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	var gotUserID string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			t.Error("user_id not found in context")
		}
		gotUserID = uid
		w.WriteHeader(http.StatusOK)
	})

	mw := auth.Middleware([]byte(testJWTSecret))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	mw(inner).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if gotUserID != "uuid-1" {
		t.Errorf("expected user_id 'uuid-1', got %s", gotUserID)
	}
}

func TestMiddleware_RefreshTokenRejected(t *testing.T) {
	tok := makeToken(t, testJWTSecret, jwt.MapClaims{
		"sub": "uuid-1",
		"typ": "refresh",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	mw := auth.Middleware([]byte(testJWTSecret))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	})

	mw(inner).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestMiddleware_AccessTokenAllowed(t *testing.T) {
	tok := makeToken(t, testJWTSecret, jwt.MapClaims{
		"sub": "uuid-42",
		"typ": "access",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	mw := auth.Middleware([]byte(testJWTSecret))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid, ok := auth.UserIDFromContext(r.Context())
		if !ok || uid != "uuid-42" {
			t.Errorf("expected user_id uuid-42, got %q (ok=%v)", uid, ok)
		}
		w.WriteHeader(http.StatusOK)
	})

	mw(inner).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestMiddleware_MissingHeader(t *testing.T) {
	mw := auth.Middleware([]byte(testJWTSecret))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	})

	mw(inner).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestMiddleware_InvalidFormat(t *testing.T) {
	mw := auth.Middleware([]byte(testJWTSecret))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "InvalidFormat")
	rec := httptest.NewRecorder()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	})

	mw(inner).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestMiddleware_ExpiredToken(t *testing.T) {
	tok := makeToken(t, testJWTSecret, jwt.MapClaims{
		"sub": "uuid-1",
		"exp": time.Now().Add(-time.Hour).Unix(),
	})

	mw := auth.Middleware([]byte(testJWTSecret))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	})

	mw(inner).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestMiddleware_WrongSecret(t *testing.T) {
	tok := makeToken(t, "other-secret", jwt.MapClaims{
		"sub": "uuid-1",
		"exp": time.Now().Add(time.Hour).Unix(),
	})

	mw := auth.Middleware([]byte(testJWTSecret))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()

	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not be called")
	})

	mw(inner).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}
