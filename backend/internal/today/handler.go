package today

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"improve-platform/internal/auth"
	apperr "improve-platform/pkg/errors"
	"improve-platform/pkg/httpresp"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetToday() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		resp, err := h.svc.GetToday(r.Context(), userID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) SetTasks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req SetTodayTasksRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if err := h.svc.SetTasks(r.Context(), userID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) ToggleTask() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		taskID := chi.URLParam(r, "taskID")
		if taskID == "" {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "missing task ID")
			return
		}

		var req ToggleTaskRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if err := h.svc.ToggleTask(r.Context(), userID, taskID, req.IsCompleted); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) SaveReflection() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req SaveReflectionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if err := h.svc.SaveReflection(r.Context(), userID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleError(w http.ResponseWriter, err error) {
	if apperr.Is(err, ErrTaskNotInPlan) {
		httpresp.Error(w, http.StatusNotFound, "task_not_in_plan", "task is not in today's plan")
		return
	}
	slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
	httpresp.Error(w, http.StatusInternalServerError, "internal_error", "internal server error")
}
