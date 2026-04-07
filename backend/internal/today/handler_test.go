package today_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/singl3focus/improve-platform/internal/auth"
	"github.com/singl3focus/improve-platform/internal/today"
)

type mockService struct {
	getTodayFn       func(ctx context.Context, userID string) (today.TodayResponse, error)
	setTasksFn       func(ctx context.Context, userID string, req today.SetTodayTasksRequest) error
	toggleTaskFn     func(ctx context.Context, userID, taskID string, isCompleted bool) error
	saveReflectionFn func(ctx context.Context, userID string, req today.SaveReflectionRequest) error
}

func (m *mockService) GetToday(ctx context.Context, userID string) (today.TodayResponse, error) {
	return m.getTodayFn(ctx, userID)
}
func (m *mockService) SetTasks(ctx context.Context, userID string, req today.SetTodayTasksRequest) error {
	return m.setTasksFn(ctx, userID, req)
}
func (m *mockService) ToggleTask(ctx context.Context, userID, taskID string, isCompleted bool) error {
	return m.toggleTaskFn(ctx, userID, taskID, isCompleted)
}
func (m *mockService) SaveReflection(ctx context.Context, userID string, req today.SaveReflectionRequest) error {
	return m.saveReflectionFn(ctx, userID, req)
}

func authedRequest(method, url string, body []byte) *http.Request {
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, url, bytes.NewReader(body))
	} else {
		req = httptest.NewRequest(method, url, nil)
	}
	ctx := auth.WithUserID(req.Context(), "user-1")
	return req.WithContext(ctx)
}

func withURLParams(req *http.Request, pairs ...string) *http.Request {
	rctx := chi.NewRouteContext()
	for i := 0; i+1 < len(pairs); i += 2 {
		rctx.URLParams.Add(pairs[i], pairs[i+1])
	}
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	return req.WithContext(ctx)
}

func TestHandler_GetToday_Success(t *testing.T) {
	svc := &mockService{
		getTodayFn: func(_ context.Context, _ string) (today.TodayResponse, error) {
			return today.TodayResponse{
				Date:  "2026-03-29",
				Tasks: []today.TodayTask{{ID: "t1", Title: "Read chapter", IsCompleted: false}},
			}, nil
		},
	}
	h := today.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/today", nil)
	rec := httptest.NewRecorder()

	h.GetToday().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp today.TodayResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Date != "2026-03-29" {
		t.Errorf("expected date 2026-03-29, got %s", resp.Date)
	}
	if len(resp.Tasks) != 1 {
		t.Errorf("expected 1 task, got %d", len(resp.Tasks))
	}
}

func TestHandler_GetToday_Unauthorized(t *testing.T) {
	h := today.NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/today", nil)
	rec := httptest.NewRecorder()

	h.GetToday().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_SetTasks_Success(t *testing.T) {
	svc := &mockService{
		setTasksFn: func(_ context.Context, _ string, req today.SetTodayTasksRequest) error {
			if len(req.TaskIDs) != 2 {
				t.Errorf("expected 2 task IDs, got %d", len(req.TaskIDs))
			}
			return nil
		},
	}
	h := today.NewHandler(svc)

	body, _ := json.Marshal(map[string]any{"task_ids": []string{"t1", "t2"}})
	req := authedRequest(http.MethodPut, "/api/v1/today/tasks", body)
	rec := httptest.NewRecorder()

	h.SetTasks().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

func TestHandler_ToggleTask_Success(t *testing.T) {
	var toggled bool
	svc := &mockService{
		toggleTaskFn: func(_ context.Context, _, taskID string, isCompleted bool) error {
			if taskID != "task-1" {
				t.Errorf("expected task-1, got %s", taskID)
			}
			if !isCompleted {
				t.Error("expected isCompleted=true")
			}
			toggled = true
			return nil
		},
	}
	h := today.NewHandler(svc)

	body, _ := json.Marshal(map[string]any{"is_completed": true})
	req := authedRequest(http.MethodPatch, "/api/v1/today/tasks/task-1/toggle", body)
	req = withURLParams(req, "taskID", "task-1")
	rec := httptest.NewRecorder()

	h.ToggleTask().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
	if !toggled {
		t.Error("expected toggle to be called")
	}
}

func TestHandler_ToggleTask_NotInPlan(t *testing.T) {
	svc := &mockService{
		toggleTaskFn: func(_ context.Context, _, _ string, _ bool) error {
			return today.ErrTaskNotInPlan
		},
	}
	h := today.NewHandler(svc)

	body, _ := json.Marshal(map[string]any{"is_completed": true})
	req := authedRequest(http.MethodPatch, "/api/v1/today/tasks/missing/toggle", body)
	req = withURLParams(req, "taskID", "missing")
	rec := httptest.NewRecorder()

	h.ToggleTask().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestHandler_SaveReflection_Success(t *testing.T) {
	svc := &mockService{
		saveReflectionFn: func(_ context.Context, _ string, req today.SaveReflectionRequest) error {
			if req.Reflection != "Learned about Go testing" {
				t.Errorf("unexpected reflection: %s", req.Reflection)
			}
			return nil
		},
	}
	h := today.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"reflection": "Learned about Go testing"})
	req := authedRequest(http.MethodPatch, "/api/v1/today/reflection", body)
	rec := httptest.NewRecorder()

	h.SaveReflection().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}
