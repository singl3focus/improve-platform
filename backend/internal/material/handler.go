package material

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

func (h *Handler) CreateMaterial() http.HandlerFunc {
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
		if req.TopicID == "" || req.Title == "" || req.Type == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "topic_id, title and type are required")
			return
		}

		resp, err := h.svc.CreateMaterial(r.Context(), userID, req)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusCreated, resp)
	}
}

func (h *Handler) GetMaterial() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		materialID := chi.URLParam(r, "materialID")
		if !validateUUIDPathParam(w, materialID, "material_id") {
			return
		}
		resp, err := h.svc.GetMaterial(r.Context(), userID, materialID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) ListTopicMaterials() http.HandlerFunc {
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
		resp, err := h.svc.ListByTopic(r.Context(), userID, topicID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) UpdateMaterial() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		materialID := chi.URLParam(r, "materialID")
		if !validateUUIDPathParam(w, materialID, "material_id") {
			return
		}
		var req UpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		if req.Title == "" || req.Type == "" {
			httpresp.Error(w, http.StatusBadRequest, "validation_error", "title and type are required")
			return
		}

		if err := h.svc.UpdateMaterial(r.Context(), userID, materialID, req); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) DeleteMaterial() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		materialID := chi.URLParam(r, "materialID")
		if !validateUUIDPathParam(w, materialID, "material_id") {
			return
		}
		if err := h.svc.DeleteMaterial(r.Context(), userID, materialID); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleError(w http.ResponseWriter, err error) {
	switch {
	case apperr.Is(err, ErrMaterialNotFound):
		httpresp.Error(w, http.StatusNotFound, "material_not_found", "material not found")
	case apperr.Is(err, ErrInvalidMaterialType):
		httpresp.Error(w, http.StatusBadRequest, "invalid_material_type", "type must be one of: book, article, course, video")
	case apperr.Is(err, ErrInvalidAmount):
		httpresp.Error(w, http.StatusBadRequest, "invalid_amount", "total_amount and completed_amount must be valid non-negative values, and completed_amount must be <= total_amount")
	case apperr.Is(err, ErrTopicNotFound):
		httpresp.Error(w, http.StatusNotFound, "topic_not_found", "topic not found or does not belong to user")
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
