package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/singl3focus/improve-platform/internal/auth"
	apperr "github.com/singl3focus/improve-platform/pkg/errors"
	"github.com/singl3focus/improve-platform/pkg/httpresp"
)

type mockService struct {
	registerFn       func(ctx context.Context, fullName, email, password string) (auth.TokenResponse, error)
	loginFn          func(ctx context.Context, email, password string) (auth.TokenResponse, error)
	refreshFn        func(ctx context.Context, refreshToken string) (auth.TokenResponse, error)
	logoutFn         func(ctx context.Context, refreshToken string) error
	getCurrentUserFn func(ctx context.Context, userID string) (auth.UserResponse, error)
	updateProfileFn  func(ctx context.Context, userID string, req auth.UpdateProfileRequest) (auth.UserResponse, error)
}

func (m *mockService) Register(ctx context.Context, fullName, email, password string) (auth.TokenResponse, error) {
	return m.registerFn(ctx, fullName, email, password)
}

func (m *mockService) Login(ctx context.Context, email, password string) (auth.TokenResponse, error) {
	return m.loginFn(ctx, email, password)
}

func (m *mockService) Refresh(ctx context.Context, refreshToken string) (auth.TokenResponse, error) {
	return m.refreshFn(ctx, refreshToken)
}

func (m *mockService) Logout(ctx context.Context, refreshToken string) error {
	return m.logoutFn(ctx, refreshToken)
}

func (m *mockService) GetCurrentUser(ctx context.Context, userID string) (auth.UserResponse, error) {
	return m.getCurrentUserFn(ctx, userID)
}

func (m *mockService) UpdateProfile(ctx context.Context, userID string, req auth.UpdateProfileRequest) (auth.UserResponse, error) {
	if m.updateProfileFn != nil {
		return m.updateProfileFn(ctx, userID, req)
	}
	return auth.UserResponse{}, nil
}

func TestHandler_Register_Success(t *testing.T) {
	svc := &mockService{
		registerFn: func(_ context.Context, fullName, _, _ string) (auth.TokenResponse, error) {
			if fullName != "Ada Lovelace" {
				t.Fatalf("expected full_name 'Ada Lovelace', got %q", fullName)
			}
			return auth.TokenResponse{AccessToken: "tok", RefreshToken: "ref"}, nil
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"full_name": "Ada Lovelace", "email": "a@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", rec.Code)
	}

	var resp auth.TokenResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.AccessToken != "tok" {
		t.Errorf("expected token 'tok', got %s", resp.AccessToken)
	}
	if resp.RefreshToken != "ref" {
		t.Errorf("expected refresh token 'ref', got %s", resp.RefreshToken)
	}
}

func TestHandler_Register_MissingFields(t *testing.T) {
	h := auth.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{"full_name": "Ada Lovelace", "email": ""})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_Register_MissingFullName(t *testing.T) {
	h := auth.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{"email": "a@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "validation_error" {
		t.Errorf("expected code 'validation_error', got %s", resp.Error.Code)
	}
}

func TestHandler_Register_ShortPassword(t *testing.T) {
	h := auth.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{"full_name": "Ada Lovelace", "email": "a@b.com", "password": "short"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_Register_EmailExists(t *testing.T) {
	svc := &mockService{
		registerFn: func(_ context.Context, _, _, _ string) (auth.TokenResponse, error) {
			return auth.TokenResponse{}, auth.ErrEmailExists
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"full_name": "Ada Lovelace", "email": "dup@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register().ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", rec.Code)
	}
}

func TestHandler_Login_Success(t *testing.T) {
	svc := &mockService{
		loginFn: func(_ context.Context, _, _ string) (auth.TokenResponse, error) {
			return auth.TokenResponse{AccessToken: "tok", RefreshToken: "ref"}, nil
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"email": "a@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp auth.TokenResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.AccessToken != "tok" {
		t.Errorf("expected token 'tok', got %s", resp.AccessToken)
	}
	if resp.RefreshToken != "ref" {
		t.Errorf("expected refresh token 'ref', got %s", resp.RefreshToken)
	}
}

func TestHandler_Login_InvalidCredentials(t *testing.T) {
	svc := &mockService{
		loginFn: func(_ context.Context, _, _ string) (auth.TokenResponse, error) {
			return auth.TokenResponse{}, auth.ErrInvalidCredentials
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"email": "a@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "bad_request" {
		t.Errorf("expected code 'bad_request', got %s", resp.Error.Code)
	}
}

func TestHandler_Login_UserNotFound(t *testing.T) {
	svc := &mockService{
		loginFn: func(_ context.Context, _, _ string) (auth.TokenResponse, error) {
			return auth.TokenResponse{}, auth.ErrUserNotFound
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"email": "missing@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "bad_request" {
		t.Errorf("expected code 'bad_request', got %s", resp.Error.Code)
	}
}

func TestHandler_Me_Success(t *testing.T) {
	svc := &mockService{
		getCurrentUserFn: func(_ context.Context, id string) (auth.UserResponse, error) {
			return auth.UserResponse{ID: id, FullName: "Ada Lovelace", Email: "a@b.com"}, nil
		},
	}
	h := auth.NewHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	ctx := auth.WithUserID(req.Context(), "uuid-1")
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	h.Me().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp auth.UserResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.ID != "uuid-1" {
		t.Errorf("expected ID uuid-1, got %s", resp.ID)
	}
	if resp.FullName != "Ada Lovelace" {
		t.Errorf("expected full_name Ada Lovelace, got %s", resp.FullName)
	}
}

func TestHandler_Me_NoAuth(t *testing.T) {
	h := auth.NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	rec := httptest.NewRecorder()

	h.Me().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_Me_NotFound(t *testing.T) {
	svc := &mockService{
		getCurrentUserFn: func(_ context.Context, _ string) (auth.UserResponse, error) {
			return auth.UserResponse{}, auth.ErrUserNotFound
		},
	}
	h := auth.NewHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	ctx := auth.WithUserID(req.Context(), "uuid-1")
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	h.Me().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "not_found" {
		t.Errorf("expected code 'not_found', got %s", resp.Error.Code)
	}
}

// По AC #1, #3: register при любой ошибке (в т.ч. unhandled) возвращает 400 без internal_error; ошибка логируется с ops trace.
func TestHandler_Register_UnhandledError_ReturnsBadRequest(t *testing.T) {
	var logBuf bytes.Buffer
	prevLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logBuf, nil)))
	t.Cleanup(func() {
		slog.SetDefault(prevLogger)
	})

	svc := &mockService{
		registerFn: func(_ context.Context, _, _, _ string) (auth.TokenResponse, error) {
			return auth.TokenResponse{}, apperr.E(
				apperr.Op("UseCase.Register"),
				apperr.E(apperr.Op("Repo.Create"), context.DeadlineExceeded),
			)
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"full_name": "Ada Lovelace", "email": "a@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Register().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 (AC #1), got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code == "internal_error" {
		t.Errorf("AC #3: must not return internal_error for user-facing register, got %s", resp.Error.Code)
	}
	if resp.Error.Code != "bad_request" {
		t.Errorf("expected code 'bad_request', got %s", resp.Error.Code)
	}
	if resp.Error.Message != "registration failed" {
		t.Errorf("expected message 'registration failed', got %s", resp.Error.Message)
	}

	logLine := logBuf.String()
	if !strings.Contains(logLine, "UseCase.Register > Repo.Create") {
		t.Errorf("expected ops trace in logs, got %q", logLine)
	}
}

// По AC #2, #3: login при любой ошибке (в т.ч. unhandled) возвращает 400 без internal_error.
func TestHandler_Login_UnhandledError_ReturnsBadRequest(t *testing.T) {
	svc := &mockService{
		loginFn: func(_ context.Context, _, _ string) (auth.TokenResponse, error) {
			return auth.TokenResponse{}, apperr.E(
				apperr.Op("UseCase.Login"),
				apperr.E(apperr.Op("Repo.FindByEmail"), context.DeadlineExceeded),
			)
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"email": "a@b.com", "password": "12345678"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Login().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 (AC #3), got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code == "internal_error" {
		t.Errorf("AC #3: must not return internal_error for user-facing login, got %s", resp.Error.Code)
	}
	if resp.Error.Code != "bad_request" {
		t.Errorf("expected code 'bad_request', got %s", resp.Error.Code)
	}
	if resp.Error.Message != "invalid email or password" {
		t.Errorf("expected message 'invalid email or password', got %s", resp.Error.Message)
	}
}

func TestHandler_Refresh_Success_WithCamelCasePayload(t *testing.T) {
	svc := &mockService{
		refreshFn: func(_ context.Context, refreshToken string) (auth.TokenResponse, error) {
			if refreshToken != "refresh-token" {
				t.Fatalf("unexpected refresh token: %s", refreshToken)
			}
			return auth.TokenResponse{
				AccessToken:      "new-access",
				RefreshToken:     "new-refresh",
				AccessExpiresIn:  900,
				RefreshExpiresIn: 1209600,
			}, nil
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"refreshToken": "refresh-token"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Refresh().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp auth.TokenResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" {
		t.Fatalf("expected access and refresh tokens, got %+v", resp)
	}
}

func TestHandler_Refresh_InvalidToken(t *testing.T) {
	svc := &mockService{
		refreshFn: func(_ context.Context, _ string) (auth.TokenResponse, error) {
			return auth.TokenResponse{}, auth.ErrInvalidRefreshToken
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"refreshToken": "bad-token"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Refresh().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "invalid_refresh_token" {
		t.Errorf("expected code 'invalid_refresh_token', got %s", resp.Error.Code)
	}
}

func TestHandler_Logout_Success(t *testing.T) {
	svc := &mockService{
		logoutFn: func(_ context.Context, refreshToken string) error {
			if refreshToken != "refresh-token" {
				t.Fatalf("unexpected refresh token: %s", refreshToken)
			}
			return nil
		},
	}
	h := auth.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"refreshToken": "refresh-token"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Logout().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestHandler_Logout_MissingToken(t *testing.T) {
	h := auth.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Logout().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "validation_error" {
		t.Errorf("expected code 'validation_error', got %s", resp.Error.Code)
	}
}
