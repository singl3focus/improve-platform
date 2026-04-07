package material_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/singl3focus/improve-platform/internal/auth"
	"github.com/singl3focus/improve-platform/internal/material"
	"github.com/singl3focus/improve-platform/pkg/httpresp"
)

type mockService struct {
	createMaterialFn func(ctx context.Context, userID string, req material.CreateRequest) (material.MaterialResponse, error)
	getMaterialFn    func(ctx context.Context, userID, materialID string) (material.MaterialResponse, error)
	listByTopicFn    func(ctx context.Context, userID, topicID string) ([]material.MaterialResponse, error)
	updateMaterialFn func(ctx context.Context, userID, materialID string, req material.UpdateRequest) error
	deleteMaterialFn func(ctx context.Context, userID, materialID string) error
}

func (m *mockService) CreateMaterial(ctx context.Context, userID string, req material.CreateRequest) (material.MaterialResponse, error) {
	return m.createMaterialFn(ctx, userID, req)
}
func (m *mockService) GetMaterial(ctx context.Context, userID, materialID string) (material.MaterialResponse, error) {
	return m.getMaterialFn(ctx, userID, materialID)
}
func (m *mockService) ListByTopic(ctx context.Context, userID, topicID string) ([]material.MaterialResponse, error) {
	return m.listByTopicFn(ctx, userID, topicID)
}
func (m *mockService) UpdateMaterial(ctx context.Context, userID, materialID string, req material.UpdateRequest) error {
	return m.updateMaterialFn(ctx, userID, materialID, req)
}
func (m *mockService) DeleteMaterial(ctx context.Context, userID, materialID string) error {
	return m.deleteMaterialFn(ctx, userID, materialID)
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

// --- CreateMaterial handler tests ---

func TestHandler_CreateMaterial_Success(t *testing.T) {
	svc := &mockService{
		createMaterialFn: func(_ context.Context, _ string, req material.CreateRequest) (material.MaterialResponse, error) {
			return material.MaterialResponse{ID: "mat-1", TopicID: req.TopicID, Title: req.Title, Type: req.Type, Unit: "pages", TotalAmount: req.TotalAmount, CompletedAmount: req.CompletedAmount, Progress: 10}, nil
		},
	}
	h := material.NewHandler(svc)

	body, _ := json.Marshal(map[string]interface{}{
		"topic_id":         "topic-1",
		"title":            "Go Book",
		"type":             "book",
		"total_amount":     120,
		"completed_amount": 12,
		"position":         1,
	})
	req := authedRequest(http.MethodPost, "/api/v1/materials", body)
	rec := httptest.NewRecorder()

	h.CreateMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", rec.Code)
	}

	var resp material.MaterialResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.ID != "mat-1" {
		t.Errorf("expected ID mat-1, got %s", resp.ID)
	}
}

func TestHandler_CreateMaterial_MissingTitle(t *testing.T) {
	h := material.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{"topic_id": "topic-1", "type": "book"})
	req := authedRequest(http.MethodPost, "/api/v1/materials", body)
	rec := httptest.NewRecorder()

	h.CreateMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_CreateMaterial_MissingTopicID(t *testing.T) {
	h := material.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]string{"title": "Book", "type": "book"})
	req := authedRequest(http.MethodPost, "/api/v1/materials", body)
	rec := httptest.NewRecorder()

	h.CreateMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestHandler_CreateMaterial_InvalidType(t *testing.T) {
	svc := &mockService{
		createMaterialFn: func(_ context.Context, _ string, _ material.CreateRequest) (material.MaterialResponse, error) {
			return material.MaterialResponse{}, material.ErrInvalidMaterialType
		},
	}
	h := material.NewHandler(svc)

	body, _ := json.Marshal(map[string]interface{}{
		"topic_id":         "topic-1",
		"title":            "Book",
		"type":             "podcast",
		"total_amount":     2,
		"completed_amount": 1,
	})
	req := authedRequest(http.MethodPost, "/api/v1/materials", body)
	rec := httptest.NewRecorder()

	h.CreateMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "invalid_material_type" {
		t.Errorf("expected code 'invalid_material_type', got %s", resp.Error.Code)
	}
}

// --- GetMaterial handler tests ---

func TestHandler_GetMaterial_Success(t *testing.T) {
	svc := &mockService{
		getMaterialFn: func(_ context.Context, _, _ string) (material.MaterialResponse, error) {
			return material.MaterialResponse{ID: "mat-1", Title: "Go Book", Type: "course", Unit: "lessons", TotalAmount: 8, CompletedAmount: 4, Progress: 50}, nil
		},
	}
	h := material.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/materials/mat-1", nil), "materialID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.GetMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestHandler_GetMaterial_NotFound(t *testing.T) {
	svc := &mockService{
		getMaterialFn: func(_ context.Context, _, _ string) (material.MaterialResponse, error) {
			return material.MaterialResponse{}, material.ErrMaterialNotFound
		},
	}
	h := material.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/materials/nonexistent", nil), "materialID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.GetMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}

	var resp httpresp.ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.Error.Code != "material_not_found" {
		t.Errorf("expected code 'material_not_found', got %s", resp.Error.Code)
	}
}

// --- ListTopicMaterials handler tests ---

func TestHandler_ListTopicMaterials_Success(t *testing.T) {
	svc := &mockService{
		listByTopicFn: func(_ context.Context, _, _ string) ([]material.MaterialResponse, error) {
			return []material.MaterialResponse{
				{ID: "m1", Title: "Book A", Position: 0},
				{ID: "m2", Title: "Book B", Position: 1},
			}, nil
		},
	}
	h := material.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/roadmap/topics/topic-1/materials", nil), "topicID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.ListTopicMaterials().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp []material.MaterialResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(resp) != 2 {
		t.Errorf("expected 2 materials, got %d", len(resp))
	}
}

// --- UpdateMaterial handler tests ---

func TestHandler_UpdateMaterial_Success(t *testing.T) {
	svc := &mockService{
		updateMaterialFn: func(_ context.Context, _, _ string, _ material.UpdateRequest) error {
			return nil
		},
	}
	h := material.NewHandler(svc)

	body, _ := json.Marshal(map[string]interface{}{
		"title":            "Updated Book",
		"type":             "video",
		"total_amount":     10,
		"completed_amount": 7,
		"position":         2,
	})
	req := withURLParams(authedRequest(http.MethodPut, "/api/v1/materials/mat-1", body), "materialID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.UpdateMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

func TestHandler_UpdateMaterial_MissingTitle(t *testing.T) {
	h := material.NewHandler(&mockService{})

	body, _ := json.Marshal(map[string]interface{}{"type": "book", "total_amount": 10, "completed_amount": 5})
	req := withURLParams(authedRequest(http.MethodPut, "/api/v1/materials/mat-1", body), "materialID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.UpdateMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

// --- DeleteMaterial handler tests ---

func TestHandler_DeleteMaterial_Success(t *testing.T) {
	svc := &mockService{
		deleteMaterialFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	}
	h := material.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodDelete, "/api/v1/materials/mat-1", nil), "materialID", "11111111-1111-1111-1111-111111111111")
	rec := httptest.NewRecorder()

	h.DeleteMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}

// --- NoAuth test ---

func TestHandler_NoAuth(t *testing.T) {
	h := material.NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/materials/mat-1", nil)
	rec := httptest.NewRecorder()

	h.GetMaterial().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_GetMaterial_InvalidMaterialID(t *testing.T) {
	svc := &mockService{
		getMaterialFn: func(_ context.Context, _, _ string) (material.MaterialResponse, error) {
			t.Fatal("service should not be called for invalid UUID")
			return material.MaterialResponse{}, nil
		},
	}
	h := material.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/materials/not-a-uuid", nil), "materialID", "not-a-uuid")
	rec := httptest.NewRecorder()

	h.GetMaterial().ServeHTTP(rec, req)

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

func TestHandler_ListTopicMaterials_InvalidTopicID(t *testing.T) {
	svc := &mockService{
		listByTopicFn: func(_ context.Context, _, _ string) ([]material.MaterialResponse, error) {
			t.Fatal("service should not be called for invalid UUID")
			return nil, nil
		},
	}
	h := material.NewHandler(svc)

	req := withURLParams(authedRequest(http.MethodGet, "/api/v1/roadmap/topics/not-a-uuid/materials", nil), "topicID", "not-a-uuid")
	rec := httptest.NewRecorder()

	h.ListTopicMaterials().ServeHTTP(rec, req)

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
