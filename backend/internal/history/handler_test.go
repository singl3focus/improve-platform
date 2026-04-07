package history_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/singl3focus/improve-platform/internal/auth"
	"github.com/singl3focus/improve-platform/internal/history"
	apperr "github.com/singl3focus/improve-platform/pkg/errors"
	"github.com/singl3focus/improve-platform/pkg/httpresp"
)

type mockService struct {
	recordFn           func(ctx context.Context, event history.Event) error
	getEntityHistoryFn func(ctx context.Context, userID, entityType, entityID string) ([]history.EventResponse, error)
	getUserHistoryFn   func(ctx context.Context, userID string, entityType *string, limit, offset int) ([]history.EventResponse, error)
}

func (m *mockService) Record(ctx context.Context, event history.Event) error {
	return m.recordFn(ctx, event)
}
func (m *mockService) GetEntityHistory(ctx context.Context, userID, entityType, entityID string) ([]history.EventResponse, error) {
	return m.getEntityHistoryFn(ctx, userID, entityType, entityID)
}
func (m *mockService) GetUserHistory(ctx context.Context, userID string, entityType *string, limit, offset int) ([]history.EventResponse, error) {
	return m.getUserHistoryFn(ctx, userID, entityType, limit, offset)
}

func authedRequest(method, url string) *http.Request {
	req := httptest.NewRequest(method, url, nil)
	ctx := auth.WithUserID(req.Context(), "user-1")
	return req.WithContext(ctx)
}

// --- GetHistory handler tests ---

func TestHandler_GetHistory_ByEntity(t *testing.T) {
	now := time.Now()
	svc := &mockService{
		getEntityHistoryFn: func(_ context.Context, userID, entityType, entityID string) ([]history.EventResponse, error) {
			if userID != "user-1" || entityType != "topic" || entityID != "topic-1" {
				t.Errorf("unexpected params: userID=%s entityType=%s entityID=%s", userID, entityType, entityID)
			}
			return []history.EventResponse{
				{
					ID: "ev-1", EntityType: "topic", EntityID: "topic-1",
					EventType: "business", EventName: "topic.status_changed",
					Payload:   map[string]any{"old_status": "not_started", "new_status": "in_progress"},
					CreatedAt: now,
				},
			}, nil
		},
	}
	h := history.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/history?entity_type=topic&entity_id=topic-1")
	rec := httptest.NewRecorder()

	h.GetHistory().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp []history.EventResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(resp) != 1 {
		t.Fatalf("expected 1 event, got %d", len(resp))
	}
	if resp[0].EventName != "topic.status_changed" {
		t.Errorf("expected event_name 'topic.status_changed', got %s", resp[0].EventName)
	}
}

func TestHandler_GetHistory_ByUser(t *testing.T) {
	svc := &mockService{
		getUserHistoryFn: func(_ context.Context, _ string, _ *string, _, _ int) ([]history.EventResponse, error) {
			return []history.EventResponse{
				{ID: "ev-1", EntityType: "topic", EventName: "entity.created"},
				{ID: "ev-2", EntityType: "task", EventName: "entity.created"},
			}, nil
		},
	}
	h := history.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/history")
	rec := httptest.NewRecorder()

	h.GetHistory().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp []history.EventResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(resp) != 2 {
		t.Errorf("expected 2 events, got %d", len(resp))
	}
}

func TestHandler_GetHistory_WithEntityTypeFilter(t *testing.T) {
	var gotEntityType *string
	svc := &mockService{
		getUserHistoryFn: func(_ context.Context, _ string, entityType *string, _, _ int) ([]history.EventResponse, error) {
			gotEntityType = entityType
			return []history.EventResponse{}, nil
		},
	}
	h := history.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/history?entity_type=task")
	rec := httptest.NewRecorder()

	h.GetHistory().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if gotEntityType == nil || *gotEntityType != "task" {
		t.Error("expected entity_type filter 'task' to be passed")
	}
}

func TestHandler_GetHistory_WithPagination(t *testing.T) {
	var gotLimit, gotOffset int
	svc := &mockService{
		getUserHistoryFn: func(_ context.Context, _ string, _ *string, limit, offset int) ([]history.EventResponse, error) {
			gotLimit = limit
			gotOffset = offset
			return []history.EventResponse{}, nil
		},
	}
	h := history.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/history?limit=25&offset=10")
	rec := httptest.NewRecorder()

	h.GetHistory().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if gotLimit != 25 {
		t.Errorf("expected limit=25, got %d", gotLimit)
	}
	if gotOffset != 10 {
		t.Errorf("expected offset=10, got %d", gotOffset)
	}
}

func TestHandler_GetHistory_NoAuth(t *testing.T) {
	h := history.NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/history", nil)
	rec := httptest.NewRecorder()

	h.GetHistory().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "unauthorized" {
		t.Errorf("expected code 'unauthorized', got %s", resp.Error.Code)
	}
}

func TestHandler_GetHistory_ServiceError(t *testing.T) {
	var logBuf bytes.Buffer
	prevLogger := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logBuf, nil)))
	t.Cleanup(func() {
		slog.SetDefault(prevLogger)
	})

	svc := &mockService{
		getEntityHistoryFn: func(_ context.Context, _, _, _ string) ([]history.EventResponse, error) {
			return nil, apperr.E(
				apperr.Op("UseCase.GetEntityHistory"),
				apperr.E(apperr.Op("Repo.ListByEntity"), context.DeadlineExceeded),
			)
		},
	}
	h := history.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/history?entity_type=topic&entity_id=topic-1")
	rec := httptest.NewRecorder()

	h.GetHistory().ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "internal_error" {
		t.Errorf("expected code 'internal_error', got %s", resp.Error.Code)
	}
	if resp.Error.Message != "internal server error" {
		t.Errorf("expected message 'internal server error', got %s", resp.Error.Message)
	}

	logLine := logBuf.String()
	if !strings.Contains(logLine, "UseCase.GetEntityHistory > Repo.ListByEntity") {
		t.Errorf("expected ops trace in logs, got %q", logLine)
	}
}

func TestHandler_GetHistory_UserHistoryServiceError(t *testing.T) {
	svc := &mockService{
		getUserHistoryFn: func(_ context.Context, _ string, _ *string, _, _ int) ([]history.EventResponse, error) {
			return nil, context.DeadlineExceeded
		},
	}
	h := history.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/history")
	rec := httptest.NewRecorder()

	h.GetHistory().ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "internal_error" {
		t.Errorf("expected code 'internal_error', got %s", resp.Error.Code)
	}
}
