package roadmap

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

func (h *Handler) GetRoadmap() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		resp, err := h.svc.GetFullRoadmap(r.Context(), userID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) CreateRoadmap() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req CreateRoadmapRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
			return
		}

		resp, err := h.svc.CreateRoadmap(r.Context(), userID, req)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusCreated, resp)
	}
}

func (h *Handler) UpdateRoadmap() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req UpdateRoadmapRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
			return
		}

		if err := h.svc.UpdateRoadmap(r.Context(), userID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) CreateStage() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req CreateStageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
			return
		}

		resp, err := h.svc.CreateStage(r.Context(), userID, req)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusCreated, resp)
	}
}

func (h *Handler) UpdateStage() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		stageID := chi.URLParam(r, "stageID")
		if !validateUUIDPathParam(w, stageID, "stage_id") {
			return
		}
		var req UpdateStageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
			return
		}

		if err := h.svc.UpdateStage(r.Context(), userID, stageID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) DeleteStage() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		stageID := chi.URLParam(r, "stageID")
		if !validateUUIDPathParam(w, stageID, "stage_id") {
			return
		}
		if err := h.svc.DeleteStage(r.Context(), userID, stageID); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) CreateTopic() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		var req CreateTopicRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.StageID == "" || req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "stage_id and title are required")
			return
		}

		resp, err := h.svc.CreateTopic(r.Context(), userID, req)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusCreated, resp)
	}
}

func (h *Handler) GetTopic() http.HandlerFunc {
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
		resp, err := h.svc.GetTopic(r.Context(), userID, topicID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) UpdateTopic() http.HandlerFunc {
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
		var req UpdateTopicRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.StageID == "" || req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "stage_id and title are required")
			return
		}

		if err := h.svc.UpdateTopic(r.Context(), userID, topicID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) DeleteTopic() http.HandlerFunc {
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
		if err := h.svc.DeleteTopic(r.Context(), userID, topicID); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) UpdateTopicStatus() http.HandlerFunc {
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
		var req UpdateStatusRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Status == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "status is required")
			return
		}

		if err := h.svc.UpdateTopicStatus(r.Context(), userID, topicID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) AddDependency() http.HandlerFunc {
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
		var req AddDependencyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.DependsOnTopicID == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "depends_on_topic_id is required")
			return
		}

		if err := h.svc.AddDependency(r.Context(), userID, topicID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusCreated)
	}
}

func (h *Handler) RemoveDependency() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		topicID := chi.URLParam(r, "topicID")
		depTopicID := chi.URLParam(r, "depTopicID")
		if !validateUUIDPathParam(w, topicID, "topic_id") {
			return
		}
		if !validateUUIDPathParam(w, depTopicID, "dep_topic_id") {
			return
		}

		if err := h.svc.RemoveDependency(r.Context(), userID, topicID, depTopicID); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleError(w http.ResponseWriter, err error) {
	switch {
	case apperr.Is(err, ErrRoadmapNotFound):
		httpresp.Error(w, http.StatusNotFound, "roadmap_not_found", "roadmap not found")
	case apperr.Is(err, ErrRoadmapExists):
		httpresp.Error(w, http.StatusConflict, "roadmap_exists", "roadmap already exists for this user")
	case apperr.Is(err, ErrStageNotFound):
		httpresp.Error(w, http.StatusNotFound, "stage_not_found", "stage not found")
	case apperr.Is(err, ErrTopicNotFound):
		httpresp.Error(w, http.StatusNotFound, "topic_not_found", "topic not found")
	case apperr.Is(err, ErrCycleDetected):
		httpresp.Error(w, http.StatusConflict, "cycle_detected", "adding this dependency would create a cycle")
	case apperr.Is(err, ErrTopicBlocked):
		httpresp.Error(w, http.StatusConflict, "topic_blocked", "topic is blocked by incomplete prerequisites")
	case apperr.Is(err, ErrInvalidStatus):
		httpresp.Error(w, http.StatusBadRequest, "invalid_status", "invalid status transition")
	case apperr.Is(err, ErrDependencyExists):
		httpresp.Error(w, http.StatusConflict, "dependency_exists", "dependency already exists")
	case apperr.Is(err, ErrDependencyNotFound):
		httpresp.Error(w, http.StatusNotFound, "dependency_not_found", "dependency not found")
	case apperr.Is(err, ErrSelfDependency):
		httpresp.Error(w, http.StatusBadRequest, "self_dependency", "topic cannot depend on itself")
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
