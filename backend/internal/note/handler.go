package note

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

func (h *Handler) CreateNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		topicID := chi.URLParam(r, "topicID")
		if topicID == "" {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "missing topic ID")
			return
		}

		var req CreateNoteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}
		req.TopicID = topicID

		resp, err := h.svc.Create(r.Context(), userID, req)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusCreated, resp)
	}
}

func (h *Handler) ListByTopic() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		topicID := chi.URLParam(r, "topicID")
		if topicID == "" {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "missing topic ID")
			return
		}

		notes, err := h.svc.ListByTopic(r.Context(), userID, topicID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, notes)
	}
}

func (h *Handler) GetNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		noteID := chi.URLParam(r, "noteID")
		if noteID == "" {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "missing note ID")
			return
		}

		resp, err := h.svc.GetByID(r.Context(), userID, noteID)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) UpdateNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		noteID := chi.URLParam(r, "noteID")
		if noteID == "" {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "missing note ID")
			return
		}

		var req UpdateNoteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "invalid request body")
			return
		}

		resp, err := h.svc.Update(r.Context(), userID, noteID, req)
		if err != nil {
			handleError(w, err)
			return
		}

		httpresp.JSON(w, http.StatusOK, resp)
	}
}

func (h *Handler) DeleteNote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
			return
		}

		noteID := chi.URLParam(r, "noteID")
		if noteID == "" {
			httpresp.Error(w, http.StatusBadRequest, "bad_request", "missing note ID")
			return
		}

		if err := h.svc.Delete(r.Context(), userID, noteID); err != nil {
			handleError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleError(w http.ResponseWriter, err error) {
	if apperr.Is(err, ErrNoteNotFound) {
		httpresp.Error(w, http.StatusNotFound, "note_not_found", "note not found")
		return
	}
	slog.Error("unhandled error", "ops", apperr.OpsTrace(err), "error", err)
	httpresp.Error(w, http.StatusInternalServerError, "internal_error", "internal server error")
}
