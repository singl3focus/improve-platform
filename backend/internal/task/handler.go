package task

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"

	"improve-platform/internal/auth"
	apperr "improve-platform/pkg/errors"
	"improve-platform/pkg/httpresp"
)

type Handler struct {
	svc Service
}

var uuidPathParamPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) CreateTask() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req CreateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
			return
		}

		resp, err := h.svc.CreateTask(r.Context(), userID, req)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusCreated, resp)
	}
}

func (h *Handler) GetTask() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		taskID := chi.URLParam(r, "taskID")
		if !validateUUIDPathParam(w, taskID, "task_id") {
			return
		}
		resp, err := h.svc.GetTask(r.Context(), userID, taskID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) ListTasks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var topicID *string
		if v := r.URL.Query().Get("topic_id"); v != "" {
			topicID = &v
		}

		resp, err := h.svc.ListTasks(r.Context(), userID, topicID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) UpdateTask() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		taskID := chi.URLParam(r, "taskID")
		if !validateUUIDPathParam(w, taskID, "task_id") {
			return
		}
		var req UpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
			return
		}

		if err := h.svc.UpdateTask(r.Context(), userID, taskID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) UpdateTaskStatus() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		taskID := chi.URLParam(r, "taskID")
		if !validateUUIDPathParam(w, taskID, "task_id") {
			return
		}
		var req UpdateStatusRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Status == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "status is required")
			return
		}

		if err := h.svc.UpdateTaskStatus(r.Context(), userID, taskID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) DeleteTask() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		taskID := chi.URLParam(r, "taskID")
		if !validateUUIDPathParam(w, taskID, "task_id") {
			return
		}
		if err := h.svc.DeleteTask(r.Context(), userID, taskID); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) GetTopicTasks() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		topicID := chi.URLParam(r, "topicID")
		if !validateUUIDPathParam(w, topicID, "topic_id") {
			return
		}
		resp, err := h.svc.GetTopicTasks(r.Context(), userID, topicID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func handleError(w http.ResponseWriter, err error) {
	switch {
	case apperr.Is(err, ErrTaskNotFound):
		httpresp.Error(w, http.StatusNotFound, "task_not_found", "task not found")
	case apperr.Is(err, ErrInvalidStatus):
		httpresp.Error(w, http.StatusBadRequest, "invalid_status", "invalid task status transition")
	default:
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusInternalServerError, "internal_error", "internal server error")
	}
}

func validateUUIDPathParam(w http.ResponseWriter, value, field string) bool {
	if !uuidPathParamPattern.MatchString(value) {
		httpresp.Error(w, http.StatusBadRequest, "validation_error", field+" must be a valid UUID")
		return false
	}
	return true
}
