package history

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/singl3focus/improve-platform/internal/auth"
	apperr "github.com/singl3focus/improve-platform/pkg/errors"
	"github.com/singl3focus/improve-platform/pkg/httpresp"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetHistory() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		entityType := r.URL.Query().Get("entity_type")
		entityID := r.URL.Query().Get("entity_id")

		if entityType != "" && entityID != "" {
			resp, err := h.svc.GetEntityHistory(r.Context(), userID, entityType, entityID)
			if err != nil {
				handleError(w, err)
				return
			}
			httpresp.JSON(w, http.StatusOK, resp)
			return
		}

		var entityTypePtr *string
		if entityType != "" {
			entityTypePtr = &entityType
		}

		limit := 50
		offset := 0
		if v := r.URL.Query().Get("limit"); v != "" {
			if parsed, err := strconv.Atoi(v); err == nil {
				limit = parsed
			}
		}
		if v := r.URL.Query().Get("offset"); v != "" {
			if parsed, err := strconv.Atoi(v); err == nil {
				offset = parsed
			}
		}

		resp, err := h.svc.GetUserHistory(r.Context(), userID, entityTypePtr, limit, offset)
		if err != nil {
			handleError(w, err)
			return
		}
		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func handleError(w http.ResponseWriter, err error) {
	slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
	httpresp.Error(w, http.StatusInternalServerError, "internal_error", "internal server error")
}
