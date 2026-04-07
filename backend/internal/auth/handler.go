package auth

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	apperr "github.com/singl3focus/improve-platform/pkg/errors"
	"github.com/singl3focus/improve-platform/pkg/httpresp"
)

type Handler struct {
	svc Service
}

type authOperation string

const (
	authOperationRegister      authOperation = "register"
	authOperationLogin         authOperation = "login"
	authOperationRefresh       authOperation = "refresh"
	authOperationLogout        authOperation = "logout"
	authOperationMe            authOperation = "me"
	authOperationUpdateProfile authOperation = "update_profile"
)

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

type authRequest struct {
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func parseRefreshTokenRequest(r *http.Request) (string, error) {
	var payload struct {
		RefreshTokenSnake string `json:"refresh_token"`
		RefreshTokenCamel string `json:"refreshToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		return "", err
	}
	if payload.RefreshTokenSnake != "" {
		return payload.RefreshTokenSnake, nil
	}
	return payload.RefreshTokenCamel, nil
}

func (h *Handler) Register() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req authRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		req.FullName = strings.TrimSpace(req.FullName)
		if req.FullName == "" || req.Email == "" || req.Password == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "full_name, email and password are required")
			return
		}

		if len(req.Password) < 8 {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "password must be at least 8 characters")
			return
		}

		resp, err := h.svc.Register(r.Context(), req.FullName, req.Email, req.Password)
		if err != nil {
			handleError(w, err, authOperationRegister)
			return
		}

		httpresp.JSON(w, http.StatusCreated, resp)
	}
}

func (h *Handler) Login() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req authRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if req.Email == "" || req.Password == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "email and password are required")
			return
		}

		resp, err := h.svc.Login(r.Context(), req.Email, req.Password)
		if err != nil {
			handleError(w, err, authOperationLogin)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) Me() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		resp, err := h.svc.GetCurrentUser(r.Context(), userID)
		if err != nil {
			handleError(w, err, authOperationMe)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) UpdateProfile() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req UpdateProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if req.FullName != nil {
			trimmed := strings.TrimSpace(*req.FullName)
			req.FullName = &trimmed
		}
		if req.Email != nil {
			trimmed := strings.TrimSpace(*req.Email)
			req.Email = &trimmed
		}
		if req.NewPassword != nil && len(*req.NewPassword) < 8 {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "new password must be at least 8 characters")
			return
		}

		resp, err := h.svc.UpdateProfile(r.Context(), userID, req)
		if err != nil {
			handleError(w, err, authOperationUpdateProfile)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) Refresh() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		refreshToken, err := parseRefreshTokenRequest(r)
		if err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if refreshToken == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "refresh token is required")
			return
		}

		resp, err := h.svc.Refresh(r.Context(), refreshToken)
		if err != nil {
			handleError(w, err, authOperationRefresh)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) Logout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		refreshToken, err := parseRefreshTokenRequest(r)
		if err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if refreshToken == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "refresh token is required")
			return
		}

		if err := h.svc.Logout(r.Context(), refreshToken); err != nil {
			handleError(w, err, authOperationLogout)
			return
		}

		httpresp.JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func handleError(w http.ResponseWriter, err error, op authOperation) {
	switch op {
	case authOperationRegister:
		if apperr.Is(err, ErrEmailExists) {
			httpresp.Error(w, http.StatusConflict, "email_exists", "user with this email already exists")
			return
		}
		// По AC: пользовательские auth-сценарии не возвращают 500/internal_error; fallback → 400
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusBadRequest, "bad_request", "registration failed")
	case authOperationLogin:
		if apperr.Is(err, ErrUserNotFound) || apperr.Is(err, ErrInvalidCredentials) {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid email or password")
			return
		}
		// По AC: пользовательские auth-сценарии не возвращают 500/internal_error; fallback → 400
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid email or password")
	case authOperationMe:
		if apperr.Is(err, ErrUserNotFound) {
			httpresp.Error(w, http.StatusNotFound, "not_found", "user not found")
			return
		}
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusInternalServerError, "internal_error", "failed to get user")
	case authOperationRefresh:
		if apperr.Is(err, ErrInvalidRefreshToken) || apperr.Is(err, ErrUserNotFound) {
			httpresp.Error(w, http.StatusUnauthorized, "invalid_refresh_token", "invalid refresh token")
			return
		}
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusInternalServerError, "internal_error", "refresh failed")
	case authOperationLogout:
		if apperr.Is(err, ErrInvalidRefreshToken) {
			httpresp.Error(w, http.StatusUnauthorized, "invalid_refresh_token", "invalid refresh token")
			return
		}
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusInternalServerError, "internal_error", "logout failed")
	case authOperationUpdateProfile:
		if apperr.Is(err, ErrWrongPassword) {
			httpresp.Error(w, http.StatusBadRequest, "wrong_password", "current password is incorrect")
			return
		}
		if apperr.Is(err, ErrEmailExists) {
			httpresp.Error(w, http.StatusConflict, "email_exists", "user with this email already exists")
			return
		}
		if apperr.Is(err, ErrUserNotFound) {
			httpresp.Error(w, http.StatusNotFound, "not_found", "user not found")
			return
		}
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusInternalServerError, "internal_error", "failed to update profile")
	default:
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusInternalServerError, "internal_error", "internal server error")
	}
}
