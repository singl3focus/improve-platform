package task_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"improve-platform/internal/auth"
	"improve-platform/internal/task"
	"improve-platform/pkg/httpresp"
)

type mockService struct {
	createTaskFn       func(ctx context.Context, userID string, req task.CreateRequest) (task.TaskResponse, error)
	getTaskFn          func(ctx context.Context, userID, taskID string) (task.TaskResponse, error)
	listTasksFn        func(ctx context.Context, userID string, topicID *string) ([]task.TaskResponse, error)
	updateTaskFn       func(ctx context.Context, userID, taskID string, req task.UpdateRequest) error
	updateTaskStatusFn func(ctx context.Context, userID, taskID string, req task.UpdateStatusRequest) error
	deleteTaskFn       func(ctx context.Context, userID, taskID string) error
	getTopicTasksFn    func(ctx context.Context, userID, topicID string) (task.TopicTasksResponse, error)
}

func (m *mockService) CreateTask(ctx context.Context, userID string, req task.CreateRequest) (task.TaskResponse, error) {
	return m.createTaskFn(ctx, userID, req)
}
func (m *mockService) GetTask(ctx context.Context, userID, taskID string) (task.TaskResponse, error) {
	return m.getTaskFn(ctx, userID, taskID)
}
func (m *mockService) ListTasks(ctx context.Context, userID string, topicID *string) ([]task.TaskResponse, error) {
	return m.listTasksFn(ctx, userID, topicID)
}
func (m *mockService) UpdateTask(ctx context.Context, userID, taskID string, req task.UpdateRequest) error {
	return m.updateTaskFn(ctx, userID, taskID, req)
}
func (m *mockService) UpdateTaskStatus(ctx context.Context, userID, taskID string, req task.UpdateStatusRequest) error {
	return m.updateTaskStatusFn(ctx, userID, taskID, req)
}
func (m *mockService) DeleteTask(ctx context.Context, userID, taskID string) error {
	return m.deleteTaskFn(ctx, userID, taskID)
}
func (m *mockService) GetTopicTasks(ctx context.Context, userID, topicID string) (task.TopicTasksResponse, error) {
	return m.getTopicTasksFn(ctx, userID, topicID)
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

func TestHandler_CreateTask_Success(t *testing.T) {
	svc := &mockService{
		createTaskFn: func(_ context.Context, _ string, req task.CreateRequest) (task.TaskResponse, error) {
			return task.TaskResponse{ID: "task-1", Title: req.Title, Status: "new"}, nil
		},
	}
	h := task.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"title": "My Task"})
	req := authedRequest(http.MethodPost, "/api/v1/tasks", body)
	rec := httptest.NewRecorder()

	h.CreateTask().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", rec.Code)
	}

	var resp task.TaskResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.ID != "task-1" {
		t.Errorf("expected ID task-1, got %s", resp.ID)
	}
}

func TestHandler_CreateTask_MissingTitle(t *testing.T) {
	h := task.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{"title": ""})
	req := authedRequest(http.MethodPost, "/api/v1/tasks", body)
	rec := httptest.NewRecorder()

	h.CreateTask().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_GetTask_Success(t *testing.T) {
	svc := &mockService{
		getTaskFn: func(_ context.Context, _, _ string) (task.TaskResponse, error) {
			return task.TaskResponse{ID: "task-1", Title: "My Task", Status: "new"}, nil
		},
	}
	h := task.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/tasks/task-1", nil), "taskID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.GetTask().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestHandler_GetTask_NotFound(t *testing.T) {
	svc := &mockService{
		getTaskFn: func(_ context.Context, _, _ string) (task.TaskResponse, error) {
			return task.TaskResponse{}, task.ErrTaskNotFound
		},
	}
	h := task.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/tasks/nonexistent", nil), "taskID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.GetTask().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "task_not_found" {
		t.Errorf("expected code 'task_not_found', got %s", resp.Error.Code)
	}
}

func TestHandler_UpdateTaskStatus_Success(t *testing.T) {
	svc := &mockService{
		updateTaskStatusFn: func(_ context.Context, _, _ string, _ task.UpdateStatusRequest) error {
			return nil
		},
	}
	h := task.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"status": "in_progress"})
	req := withURLParams(authedRequest(http.MethodPatch, "/api/v1/tasks/task-1/status", body), "taskID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.UpdateTaskStatus().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

func TestHandler_UpdateTaskStatus_ToDone_Success(t *testing.T) {
	svc := &mockService{
		updateTaskStatusFn: func(_ context.Context, _, _ string, _ task.UpdateStatusRequest) error {
			return nil
		},
	}
	h := task.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"status": "done"})
	req := withURLParams(authedRequest(http.MethodPatch, "/api/v1/tasks/task-1/status", body), "taskID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.UpdateTaskStatus().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

func TestHandler_UpdateTaskStatus_InvalidStatus(t *testing.T) {
	svc := &mockService{
		updateTaskStatusFn: func(_ context.Context, _, _ string, _ task.UpdateStatusRequest) error {
			return task.ErrInvalidStatus
		},
	}
	h := task.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"status": "done"})
	req := withURLParams(authedRequest(http.MethodPatch, "/api/v1/tasks/task-1/status", body), "taskID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.UpdateTaskStatus().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "invalid_status" {
		t.Errorf("expected code 'invalid_status', got %s", resp.Error.Code)
	}
}

func TestHandler_ListTasks_Success(t *testing.T) {
	svc := &mockService{
		listTasksFn: func(_ context.Context, _ string, _ *string) ([]task.TaskResponse, error) {
			return []task.TaskResponse{
				{ID: "t1", Title: "Task 1", Status: "new"},
				{ID: "t2", Title: "Task 2", Status: "done"},
			}, nil
		},
	}
	h := task.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/tasks", nil)
	rec := httptest.NewRecorder()

	h.ListTasks().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp []task.TaskResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(resp) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(resp))
	}
}

func TestHandler_NoAuth(t *testing.T) {
	h := task.NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tasks", nil)
	rec := httptest.NewRecorder()

	h.ListTasks().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_GetTask_InvalidTaskID(t *testing.T) {
	svc := &mockService{
		getTaskFn: func(_ context.Context, _, _ string) (task.TaskResponse, error) {
			t.Fatal("service should not be called for invalid UUID")
			return task.TaskResponse{}, nil
		},
	}
	h := task.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/tasks/not-a-uuid", nil), "taskID", "not-a-uuid")
	rec := httptest.NewRecorder()

	h.GetTask().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "validation_error" {
		t.Errorf("expected code 'validation_error', got %s", resp.Error.Code)
	}
}

func TestHandler_GetTopicTasks_InvalidTopicID(t *testing.T) {
	svc := &mockService{
		getTopicTasksFn: func(_ context.Context, _, _ string) (task.TopicTasksResponse, error) {
			t.Fatal("service should not be called for invalid UUID")
			return task.TopicTasksResponse{}, nil
		},
	}
	h := task.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/topics/not-a-uuid/tasks", nil), "topicID", "not-a-uuid")
	rec := httptest.NewRecorder()

	h.GetTopicTasks().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "validation_error" {
		t.Errorf("expected code 'validation_error', got %s", resp.Error.Code)
	}
}
