package roadmap_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"improve-platform/internal/auth"
	"improve-platform/internal/roadmap"
	"improve-platform/pkg/httpresp"
)

type mockService struct {
	listRoadmapsFn       func(ctx context.Context, userID string) ([]roadmap.RoadmapListItem, error)
	getFullRoadmapFn     func(ctx context.Context, userID, roadmapID string) (roadmap.RoadmapResponse, error)
	createRoadmapFn      func(ctx context.Context, userID string, req roadmap.CreateRoadmapRequest) (roadmap.RoadmapResponse, error)
	updateRoadmapFn      func(ctx context.Context, userID, roadmapID string, req roadmap.UpdateRoadmapRequest) error
	deleteRoadmapFn      func(ctx context.Context, userID, roadmapID string) error
	createTopicFn        func(ctx context.Context, userID, roadmapID string, req roadmap.CreateTopicRequest) (roadmap.TopicResponse, error)
	getTopicFn           func(ctx context.Context, userID, topicID string) (roadmap.TopicResponse, error)
	updateTopicFn        func(ctx context.Context, userID, topicID string, req roadmap.UpdateTopicRequest) error
	updateTopicStatusFn  func(ctx context.Context, userID, topicID string, req roadmap.UpdateStatusRequest) error
	deleteTopicFn        func(ctx context.Context, userID, topicID string) error
	addDependencyFn      func(ctx context.Context, userID, topicID string, req roadmap.AddDependencyRequest) error
	setTopicConfidenceFn func(ctx context.Context, userID, topicID string, req roadmap.SetConfidenceRequest) error
	removeDependencyFn   func(ctx context.Context, userID, topicID, depTopicID string) error
}

func (m *mockService) ListRoadmaps(ctx context.Context, userID string) ([]roadmap.RoadmapListItem, error) {
	if m.listRoadmapsFn != nil {
		return m.listRoadmapsFn(ctx, userID)
	}
	return nil, nil
}
func (m *mockService) GetFullRoadmap(ctx context.Context, userID, roadmapID string) (roadmap.RoadmapResponse, error) {
	return m.getFullRoadmapFn(ctx, userID, roadmapID)
}
func (m *mockService) CreateRoadmap(ctx context.Context, userID string, req roadmap.CreateRoadmapRequest) (roadmap.RoadmapResponse, error) {
	return m.createRoadmapFn(ctx, userID, req)
}
func (m *mockService) UpdateRoadmap(ctx context.Context, userID, roadmapID string, req roadmap.UpdateRoadmapRequest) error {
	return m.updateRoadmapFn(ctx, userID, roadmapID, req)
}
func (m *mockService) DeleteRoadmap(ctx context.Context, userID, roadmapID string) error {
	if m.deleteRoadmapFn != nil {
		return m.deleteRoadmapFn(ctx, userID, roadmapID)
	}
	return nil
}
func (m *mockService) CreateTopic(ctx context.Context, userID, roadmapID string, req roadmap.CreateTopicRequest) (roadmap.TopicResponse, error) {
	return m.createTopicFn(ctx, userID, roadmapID, req)
}
func (m *mockService) GetTopic(ctx context.Context, userID, topicID string) (roadmap.TopicResponse, error) {
	return m.getTopicFn(ctx, userID, topicID)
}
func (m *mockService) UpdateTopic(ctx context.Context, userID, topicID string, req roadmap.UpdateTopicRequest) error {
	return m.updateTopicFn(ctx, userID, topicID, req)
}
func (m *mockService) UpdateTopicStatus(ctx context.Context, userID, topicID string, req roadmap.UpdateStatusRequest) error {
	return m.updateTopicStatusFn(ctx, userID, topicID, req)
}
func (m *mockService) DeleteTopic(ctx context.Context, userID, topicID string) error {
	return m.deleteTopicFn(ctx, userID, topicID)
}
func (m *mockService) SetTopicConfidence(ctx context.Context, userID, topicID string, req roadmap.SetConfidenceRequest) error {
	if m.setTopicConfidenceFn != nil {
		return m.setTopicConfidenceFn(ctx, userID, topicID, req)
	}
	return nil
}
func (m *mockService) AddDependency(ctx context.Context, userID, topicID string, req roadmap.AddDependencyRequest) error {
	return m.addDependencyFn(ctx, userID, topicID, req)
}
func (m *mockService) RemoveDependency(ctx context.Context, userID, topicID, depTopicID string) error {
	return m.removeDependencyFn(ctx, userID, topicID, depTopicID)
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

func TestHandler_CreateRoadmap_Success(t *testing.T) {
	svc := &mockService{
		createRoadmapFn: func(_ context.Context, _ string, req roadmap.CreateRoadmapRequest) (roadmap.RoadmapResponse, error) {
			return roadmap.RoadmapResponse{ID: "rm-1", Title: req.Title, Topics: []roadmap.TopicResponse{}, Dependencies: []roadmap.TopicDependencyResponse{}}, nil
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"title": "My Roadmap"})
	req := authedRequest(http.MethodPost, "/api/v1/roadmap", body)
	rec := httptest.NewRecorder()

	h.CreateRoadmap().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", rec.Code)
	}

	var resp roadmap.RoadmapResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.ID != "rm-1" {
		t.Errorf("expected ID rm-1, got %s", resp.ID)
	}
}

func TestHandler_CreateRoadmap_MissingTitle(t *testing.T) {
	h := roadmap.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{"title": ""})
	req := authedRequest(http.MethodPost, "/api/v1/roadmap", body)
	rec := httptest.NewRecorder()

	h.CreateRoadmap().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_CreateRoadmap_AlreadyExists(t *testing.T) {
	svc := &mockService{
		createRoadmapFn: func(_ context.Context, _ string, _ roadmap.CreateRoadmapRequest) (roadmap.RoadmapResponse, error) {
			return roadmap.RoadmapResponse{}, roadmap.ErrRoadmapExists
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"title": "Dup"})
	req := authedRequest(http.MethodPost, "/api/v1/roadmap", body)
	rec := httptest.NewRecorder()

	h.CreateRoadmap().ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", rec.Code)
	}
}

func TestHandler_GetRoadmap_Success(t *testing.T) {
	svc := &mockService{
		getFullRoadmapFn: func(_ context.Context, _, _ string) (roadmap.RoadmapResponse, error) {
			return roadmap.RoadmapResponse{
				ID:    "rm-1",
				Title: "My RM",
				Topics: []roadmap.TopicResponse{
					{ID: "t-1", Title: "Topic 1", TasksCount: 4, MaterialsCount: 2, ProgressPercent: 75,
						Dependencies: []string{"t-2"}},
				},
			}, nil
		},
	}
	h := roadmap.NewHandler(svc)

	req := withURLParams(
		authedRequest(http.MethodGet, "/api/v1/roadmaps/11111111-1111-1111-1111-111111111111", nil),
		"roadmapID", "11111111-1111-1111-1111-111111111111",
	)
	rec := httptest.NewRecorder()

	h.GetRoadmap().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp roadmap.RoadmapResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(resp.Topics) != 1 {
		t.Fatalf("unexpected structure: %+v", resp)
	}
	topic := resp.Topics[0]
	if topic.TasksCount != 4 || topic.MaterialsCount != 2 || topic.ProgressPercent != 75 {
		t.Errorf("unexpected metrics: tasks=%d materials=%d progress=%d", topic.TasksCount, topic.MaterialsCount, topic.ProgressPercent)
	}
}

func TestHandler_GetRoadmap_ResponseDoesNotContainStageFields(t *testing.T) {
	svc := &mockService{
		getFullRoadmapFn: func(_ context.Context, _, _ string) (roadmap.RoadmapResponse, error) {
			return roadmap.RoadmapResponse{
				ID:    "rm-1",
				Title: "My RM",
				Topics: []roadmap.TopicResponse{
					{ID: "t-1", Title: "Topic 1"},
				},
				Dependencies: []roadmap.TopicDependencyResponse{{TopicID: "t-1", DependsOnTopicID: "t-2"}},
			}, nil
		},
	}
	h := roadmap.NewHandler(svc)

	req := withURLParams(
		authedRequest(http.MethodGet, "/api/v1/roadmaps/11111111-1111-1111-1111-111111111111", nil),
		"roadmapID", "11111111-1111-1111-1111-111111111111",
	)
	rec := httptest.NewRecorder()

	h.GetRoadmap().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if strings.Contains(body, "\"stages\"") {
		t.Fatalf("response must not contain stages field: %s", body)
	}
	if strings.Contains(body, "\"stage_id\"") {
		t.Fatalf("response must not contain stage_id field: %s", body)
	}
}

func TestHandler_CreateTopic_SuccessWithoutStageFields(t *testing.T) {
	svc := &mockService{
		createTopicFn: func(_ context.Context, _, _ string, req roadmap.CreateTopicRequest) (roadmap.TopicResponse, error) {
			if req.Title != "Topic 1" || req.Description != "desc" || req.Position != 3 {
				t.Fatalf("unexpected request: %+v", req)
			}
			return roadmap.TopicResponse{ID: "topic-1", Title: req.Title, Description: req.Description, Position: req.Position}, nil
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]any{
		"title":       "Topic 1",
		"description": "desc",
		"position":    3,
	})
	req := withURLParams(
		authedRequest(http.MethodPost, "/api/v1/roadmaps/rm-1/topics", body),
		"roadmapID", "11111111-1111-1111-1111-111111111111",
	)
	rec := httptest.NewRecorder()

	h.CreateTopic().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}

	var resp roadmap.TopicResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.ID != "topic-1" {
		t.Fatalf("expected topic-1, got %s", resp.ID)
	}
}

func TestHandler_CreateTopic_DirectionalSuccess(t *testing.T) {
	svc := &mockService{
		createTopicFn: func(_ context.Context, _, _ string, req roadmap.CreateTopicRequest) (roadmap.TopicResponse, error) {
			if req.Direction != roadmap.TopicCreateDirectionRight {
				t.Fatalf("unexpected direction: %s", req.Direction)
			}
			if req.RelativeToTopicID != "11111111-1111-1111-1111-111111111111" {
				t.Fatalf("unexpected relative id: %s", req.RelativeToTopicID)
			}
			return roadmap.TopicResponse{ID: "topic-2", Title: req.Title, Description: req.Description}, nil
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]any{
		"title":                "Topic 2",
		"description":          "desc",
		"direction":            "right",
		"relative_to_topic_id": "11111111-1111-1111-1111-111111111111",
	})
	req := withURLParams(
		authedRequest(http.MethodPost, "/api/v1/roadmaps/rm-1/topics", body),
		"roadmapID", "22222222-2222-2222-2222-222222222222",
	)
	rec := httptest.NewRecorder()

	h.CreateTopic().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}
}

func TestHandler_CreateTopic_DirectionalMissingRelativeTopicID(t *testing.T) {
	h := roadmap.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]any{
		"title":       "Topic 2",
		"description": "desc",
		"direction":   "below",
	})
	req := withURLParams(
		authedRequest(http.MethodPost, "/api/v1/roadmaps/rm-1/topics", body),
		"roadmapID", "11111111-1111-1111-1111-111111111111",
	)
	rec := httptest.NewRecorder()

	h.CreateTopic().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_CreateTopic_DirectionalInvalidDirection(t *testing.T) {
	h := roadmap.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]any{
		"title":                "Topic 2",
		"description":          "desc",
		"direction":            "diagonal",
		"relative_to_topic_id": "11111111-1111-1111-1111-111111111111",
	})
	req := withURLParams(
		authedRequest(http.MethodPost, "/api/v1/roadmaps/rm-1/topics", body),
		"roadmapID", "22222222-2222-2222-2222-222222222222",
	)
	rec := httptest.NewRecorder()

	h.CreateTopic().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_UpdateTopic_SuccessWithoutStageFields(t *testing.T) {
	called := false
	svc := &mockService{
		updateTopicFn: func(_ context.Context, _, topicID string, req roadmap.UpdateTopicRequest) error {
			called = true
			if topicID != "11111111-1111-1111-1111-111111111111" {
				t.Fatalf("unexpected topic id: %s", topicID)
			}
			if req.Title != "Updated title" || req.Description != "updated desc" || req.Position != 5 {
				t.Fatalf("unexpected request: %+v", req)
			}
			return nil
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]any{
		"title":       "Updated title",
		"description": "updated desc",
		"position":    5,
	})
	req := withURLParams(
		authedRequest(http.MethodPut, "/api/v1/roadmap/topics/topic-1", body),
		"topicID", "11111111-1111-1111-1111-111111111111",
	)
	rec := httptest.NewRecorder()

	h.UpdateTopic().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if !called {
		t.Fatal("expected updateTopic service to be called")
	}
}

func TestHandler_AddDependency_CycleRejected(t *testing.T) {
	svc := &mockService{
		addDependencyFn: func(_ context.Context, _, _ string, _ roadmap.AddDependencyRequest) error {
			return roadmap.ErrCycleDetected
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"depends_on_topic_id": "t2"})
	req := withURLParams(authedRequest(http.MethodPost, "/api/v1/roadmap/topics/t1/dependencies", body), "topicID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.AddDependency().ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "cycle_detected" {
		t.Errorf("expected code 'cycle_detected', got %s", resp.Error.Code)
	}
}

func TestHandler_AddDependency_SelfRejected(t *testing.T) {
	svc := &mockService{
		addDependencyFn: func(_ context.Context, _, _ string, _ roadmap.AddDependencyRequest) error {
			return roadmap.ErrSelfDependency
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"depends_on_topic_id": "22222222-2222-2222-2222-222222222222"})
	req := withURLParams(authedRequest(http.MethodPost, "/api/v1/roadmap/topics/t1/dependencies", body), "topicID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.AddDependency().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "self_dependency" {
		t.Errorf("expected code 'self_dependency', got %s", resp.Error.Code)
	}
}

func TestHandler_AddDependency_DuplicateRejected(t *testing.T) {
	svc := &mockService{
		addDependencyFn: func(_ context.Context, _, _ string, _ roadmap.AddDependencyRequest) error {
			return roadmap.ErrDependencyExists
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"depends_on_topic_id": "22222222-2222-2222-2222-222222222222"})
	req := withURLParams(authedRequest(http.MethodPost, "/api/v1/roadmap/topics/t1/dependencies", body), "topicID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.AddDependency().ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "dependency_exists" {
		t.Errorf("expected code 'dependency_exists', got %s", resp.Error.Code)
	}
}

func TestHandler_AddDependency_TopicNotFound(t *testing.T) {
	svc := &mockService{
		addDependencyFn: func(_ context.Context, _, _ string, _ roadmap.AddDependencyRequest) error {
			return roadmap.ErrTopicNotFound
		},
	}
	h := roadmap.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"depends_on_topic_id": "22222222-2222-2222-2222-222222222222"})
	req := withURLParams(authedRequest(http.MethodPost, "/api/v1/roadmap/topics/t1/dependencies", body), "topicID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.AddDependency().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "topic_not_found" {
		t.Errorf("expected code 'topic_not_found', got %s", resp.Error.Code)
	}
}

func TestHandler_NoAuth(t *testing.T) {
	h := roadmap.NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/roadmap", nil)
	rec := httptest.NewRecorder()

	h.GetRoadmap().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_GetTopic_InvalidTopicID(t *testing.T) {
	svc := &mockService{
		getTopicFn: func(_ context.Context, _, _ string) (roadmap.TopicResponse, error) {
			t.Fatal("service should not be called for invalid UUID")
			return roadmap.TopicResponse{}, nil
		},
	}
	h := roadmap.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/roadmap/topics/not-a-uuid", nil), "topicID", "not-a-uuid")
	rec := httptest.NewRecorder()

	h.GetTopic().ServeHTTP(rec, req)

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

func TestHandler_RemoveDependency_InvalidDepTopicID(t *testing.T) {
	svc := &mockService{
		removeDependencyFn: func(_ context.Context, _, _, _ string) error {
			t.Fatal("service should not be called for invalid UUID")
			return nil
		},
	}
	h := roadmap.NewHandler(svc)

	req := withURLParams(
		authedRequest(http.MethodDelete, "/api/v1/roadmap/topics/topic-1/dependencies/not-a-uuid", nil),
		"topicID", "11111111-1111-1111-1111-111111111111",
		"depTopicID", "not-a-uuid",
	)
	rec := httptest.NewRecorder()

	h.RemoveDependency().ServeHTTP(rec, req)

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

func TestHandler_RemoveDependency_NotFound(t *testing.T) {
	svc := &mockService{
		removeDependencyFn: func(_ context.Context, _, _, _ string) error {
			return roadmap.ErrDependencyNotFound
		},
	}
	h := roadmap.NewHandler(svc)

	req := withURLParams(
		authedRequest(http.MethodDelete, "/api/v1/roadmap/topics/topic-1/dependencies/topic-2", nil),
		"topicID", "11111111-1111-1111-1111-111111111111",
		"depTopicID", "22222222-2222-2222-2222-222222222222",
	)
	rec := httptest.NewRecorder()

	h.RemoveDependency().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "dependency_not_found" {
		t.Errorf("expected code 'dependency_not_found', got %s", resp.Error.Code)
	}
}
