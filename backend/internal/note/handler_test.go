package note_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"improve-platform/internal/auth"
	"improve-platform/internal/note"
)

type mockService struct {
	createFn      func(ctx context.Context, userID string, req note.CreateNoteRequest) (note.NoteResponse, error)
	getByIDFn     func(ctx context.Context, userID, noteID string) (note.NoteResponse, error)
	listByTopicFn func(ctx context.Context, userID, topicID string) ([]note.NoteResponse, error)
	updateFn      func(ctx context.Context, userID, noteID string, req note.UpdateNoteRequest) (note.NoteResponse, error)
	deleteFn      func(ctx context.Context, userID, noteID string) error
}

func (m *mockService) Create(ctx context.Context, userID string, req note.CreateNoteRequest) (note.NoteResponse, error) {
	return m.createFn(ctx, userID, req)
}
func (m *mockService) GetByID(ctx context.Context, userID, noteID string) (note.NoteResponse, error) {
	return m.getByIDFn(ctx, userID, noteID)
}
func (m *mockService) ListByTopic(ctx context.Context, userID, topicID string) ([]note.NoteResponse, error) {
	return m.listByTopicFn(ctx, userID, topicID)
}
func (m *mockService) Update(ctx context.Context, userID, noteID string, req note.UpdateNoteRequest) (note.NoteResponse, error) {
	return m.updateFn(ctx, userID, noteID, req)
}
func (m *mockService) Delete(ctx context.Context, userID, noteID string) error {
	return m.deleteFn(ctx, userID, noteID)
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

func TestHandler_CreateNote_Success(t *testing.T) {
	svc := &mockService{
		createFn: func(_ context.Context, _ string, req note.CreateNoteRequest) (note.NoteResponse, error) {
			return note.NoteResponse{ID: "note-1", TopicID: req.TopicID, Title: req.Title}, nil
		},
	}
	h := note.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"title": "My Note", "content": "Hello"})
	req := authedRequest(http.MethodPost, "/api/v1/topics/topic-1/notes", body)
	req = withURLParams(req, "topicID", "topic-1")
	rec := httptest.NewRecorder()

	h.CreateNote().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", rec.Code)
	}

	var resp note.NoteResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if resp.ID != "note-1" {
		t.Errorf("expected ID note-1, got %s", resp.ID)
	}
}

func TestHandler_CreateNote_Unauthorized(t *testing.T) {
	h := note.NewHandler(&mockService{})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/topics/topic-1/notes", nil)
	req = withURLParams(req, "topicID", "topic-1")
	rec := httptest.NewRecorder()

	h.CreateNote().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", rec.Code)
	}
}

func TestHandler_ListByTopic_Success(t *testing.T) {
	svc := &mockService{
		listByTopicFn: func(_ context.Context, _, _ string) ([]note.NoteResponse, error) {
			return []note.NoteResponse{
				{ID: "n1", Title: "First"},
				{ID: "n2", Title: "Second"},
			}, nil
		},
	}
	h := note.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/topics/topic-1/notes", nil)
	req = withURLParams(req, "topicID", "topic-1")
	rec := httptest.NewRecorder()

	h.ListByTopic().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var notes []note.NoteResponse
	if err := json.NewDecoder(rec.Body).Decode(&notes); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(notes) != 2 {
		t.Errorf("expected 2 notes, got %d", len(notes))
	}
}

func TestHandler_GetNote_Success(t *testing.T) {
	svc := &mockService{
		getByIDFn: func(_ context.Context, _, _ string) (note.NoteResponse, error) {
			return note.NoteResponse{ID: "note-1", Title: "Found"}, nil
		},
	}
	h := note.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/notes/note-1", nil)
	req = withURLParams(req, "noteID", "note-1")
	rec := httptest.NewRecorder()

	h.GetNote().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestHandler_GetNote_NotFound(t *testing.T) {
	svc := &mockService{
		getByIDFn: func(_ context.Context, _, _ string) (note.NoteResponse, error) {
			return note.NoteResponse{}, note.ErrNoteNotFound
		},
	}
	h := note.NewHandler(svc)

	req := authedRequest(http.MethodGet, "/api/v1/notes/missing", nil)
	req = withURLParams(req, "noteID", "missing")
	rec := httptest.NewRecorder()

	h.GetNote().ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestHandler_UpdateNote_Success(t *testing.T) {
	svc := &mockService{
		updateFn: func(_ context.Context, _, _ string, req note.UpdateNoteRequest) (note.NoteResponse, error) {
			return note.NoteResponse{ID: "note-1", Title: req.Title, Content: req.Content}, nil
		},
	}
	h := note.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"title": "Updated", "content": "New"})
	req := authedRequest(http.MethodPut, "/api/v1/notes/note-1", body)
	req = withURLParams(req, "noteID", "note-1")
	rec := httptest.NewRecorder()

	h.UpdateNote().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestHandler_DeleteNote_Success(t *testing.T) {
	svc := &mockService{
		deleteFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	}
	h := note.NewHandler(svc)

	req := authedRequest(http.MethodDelete, "/api/v1/notes/note-1", nil)
	req = withURLParams(req, "noteID", "note-1")
	rec := httptest.NewRecorder()

	h.DeleteNote().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected 204, got %d", rec.Code)
	}
}
