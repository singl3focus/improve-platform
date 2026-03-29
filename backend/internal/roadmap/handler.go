package roadmap

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"improve-platform/internal/auth"
	apperr "improve-platform/pkg/errors"
	"improve-platform/pkg/httpresp"
	"improve-platform/pkg/httputil"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListRoadmaps() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		items, err := h.svc.ListRoadmaps(r.Context(), userID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, items)
	}
}

func (h *Handler) GetRoadmap() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		roadmapID := chi.URLParam(r, "roadmapID")
		if !httputil.ValidateUUID(w, roadmapID, "roadmap_id") {
			return
		}

		resp, err := h.svc.GetFullRoadmap(r.Context(), userID, roadmapID)
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
		if !req.Type.IsValid() {
			httpresp.Error(w, http.StatusBadRequest, "invalid_roadmap_type", "roadmap type must be one of: graph, levels, cycles")
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

		roadmapID := chi.URLParam(r, "roadmapID")
		if !httputil.ValidateUUID(w, roadmapID, "roadmap_id") {
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

		if err := h.svc.UpdateRoadmap(r.Context(), userID, roadmapID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) DeleteRoadmap() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		roadmapID := chi.URLParam(r, "roadmapID")
		if !httputil.ValidateUUID(w, roadmapID, "roadmap_id") {
			return
		}

		if err := h.svc.DeleteRoadmap(r.Context(), userID, roadmapID); err != nil {
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

		roadmapID := chi.URLParam(r, "roadmapID")
		if !httputil.ValidateUUID(w, roadmapID, "roadmap_id") {
			return
		}

		var req CreateTopicRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
			return
		}
		if req.IsDirectional() {
			if req.RelativeToTopicID == "" {
				httpresp.Error(w, http.StatusBadRequest, "validation_error", "relative_to_topic_id is required for directional create")
				return
			}
			if !httputil.ValidateUUID(w, req.RelativeToTopicID, "relative_to_topic_id") {
				return
			}
			if !req.Direction.IsValid() {
				httpresp.Error(w, http.StatusBadRequest, "validation_error", "direction must be one of: left, right, below")
				return
			}
		}

		resp, err := h.svc.CreateTopic(r.Context(), userID, roadmapID, req)
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
		if !httputil.ValidateUUID(w, topicID, "topic_id") {
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
		if !httputil.ValidateUUID(w, topicID, "topic_id") {
			return
		}
		var req UpdateTopicRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title is required")
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
		if !httputil.ValidateUUID(w, topicID, "topic_id") {
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
		if !httputil.ValidateUUID(w, topicID, "topic_id") {
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

func (h *Handler) SetTopicConfidence() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		topicID := chi.URLParam(r, "topicID")
		if !httputil.ValidateUUID(w, topicID, "topic_id") {
			return
		}
		var req SetConfidenceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		if err := h.svc.SetTopicConfidence(r.Context(), userID, topicID, req); err != nil {
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
		if !httputil.ValidateUUID(w, topicID, "topic_id") {
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
		if !httputil.ValidateUUID(w, topicID, "topic_id") {
			return
		}
		if !httputil.ValidateUUID(w, depTopicID, "dep_topic_id") {
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
	case apperr.Is(err, ErrInvalidRoadmapType):
		httpresp.Error(w, http.StatusBadRequest, "invalid_roadmap_type", "roadmap type must be one of: graph, levels, cycles")
	case apperr.Is(err, ErrTopicNotFound):
		httpresp.Error(w, http.StatusNotFound, "topic_not_found", "topic not found")
	case apperr.Is(err, ErrInvalidDirection):
		httpresp.Error(w, http.StatusBadRequest, "invalid_direction", "direction must be one of: left, right, below")
	case apperr.Is(err, ErrCycleDetected):
		httpresp.Error(w, http.StatusConflict, "cycle_detected", "adding this dependency would create a cycle")
	case apperr.Is(err, ErrInvalidStatus):
		httpresp.Error(w, http.StatusBadRequest, "invalid_status", "invalid status transition")
	case apperr.Is(err, ErrDependencyExists):
		httpresp.Error(w, http.StatusConflict, "dependency_exists", "dependency already exists")
	case apperr.Is(err, ErrDependencyNotFound):
		httpresp.Error(w, http.StatusNotFound, "dependency_not_found", "dependency not found")
	case apperr.Is(err, ErrSelfDependency):
		httpresp.Error(w, http.StatusBadRequest, "self_dependency", "topic cannot depend on itself")
	case apperr.Is(err, ErrInvalidConfidence):
		httpresp.Error(w, http.StatusBadRequest, "invalid_confidence", "confidence must be between 1 and 5")
	default:
		slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
		httpresp.Error(w, http.StatusInternalServerError, "internal_error", "internal server error")
	}
}
