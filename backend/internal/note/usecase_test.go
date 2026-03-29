package note_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"improve-platform/internal/note"
)

type mockRepo struct {
	createFn      func(ctx context.Context, n note.Note) (note.Note, error)
	getByIDFn     func(ctx context.Context, userID, noteID string) (note.Note, error)
	listByTopicFn func(ctx context.Context, userID, topicID string) ([]note.Note, error)
	updateFn      func(ctx context.Context, userID, noteID, title, content string) (note.Note, error)
	deleteFn      func(ctx context.Context, userID, noteID string) error
}

func (m *mockRepo) Create(ctx context.Context, n note.Note) (note.Note, error) {
	return m.createFn(ctx, n)
}
func (m *mockRepo) GetByID(ctx context.Context, userID, noteID string) (note.Note, error) {
	return m.getByIDFn(ctx, userID, noteID)
}
func (m *mockRepo) ListByTopic(ctx context.Context, userID, topicID string) ([]note.Note, error) {
	return m.listByTopicFn(ctx, userID, topicID)
}
func (m *mockRepo) Update(ctx context.Context, userID, noteID, title, content string) (note.Note, error) {
	return m.updateFn(ctx, userID, noteID, title, content)
}
func (m *mockRepo) Delete(ctx context.Context, userID, noteID string) error {
	return m.deleteFn(ctx, userID, noteID)
}

func TestCreate_Success(t *testing.T) {
	now := time.Now()
	repo := &mockRepo{
		createFn: func(_ context.Context, n note.Note) (note.Note, error) {
			n.ID = "note-1"
			n.CreatedAt = now
			n.UpdatedAt = now
			return n, nil
		},
	}
	uc := note.NewUseCase(repo)

	resp, err := uc.Create(context.Background(), "user-1", note.CreateNoteRequest{
		TopicID: "topic-1",
		Title:   "My note",
		Content: "Some content",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ID != "note-1" {
		t.Errorf("expected ID note-1, got %s", resp.ID)
	}
	if resp.Title != "My note" {
		t.Errorf("expected title 'My note', got %s", resp.Title)
	}
	if resp.TopicID != "topic-1" {
		t.Errorf("expected topic_id 'topic-1', got %s", resp.TopicID)
	}
}

func TestCreate_RepoError(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, _ note.Note) (note.Note, error) {
			return note.Note{}, errors.New("db error")
		},
	}
	uc := note.NewUseCase(repo)

	_, err := uc.Create(context.Background(), "user-1", note.CreateNoteRequest{
		TopicID: "topic-1",
		Title:   "Fail",
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func TestGetByID_Success(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (note.Note, error) {
			return note.Note{
				ID:      "note-1",
				UserID:  "user-1",
				TopicID: "topic-1",
				Title:   "Found",
				Content: "Hello",
			}, nil
		},
	}
	uc := note.NewUseCase(repo)

	resp, err := uc.GetByID(context.Background(), "user-1", "note-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Title != "Found" {
		t.Errorf("expected title 'Found', got %s", resp.Title)
	}
}

func TestGetByID_NotFound(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (note.Note, error) {
			return note.Note{}, note.ErrNoteNotFound
		},
	}
	uc := note.NewUseCase(repo)

	_, err := uc.GetByID(context.Background(), "user-1", "missing")
	if !errors.Is(err, note.ErrNoteNotFound) {
		t.Fatalf("expected ErrNoteNotFound, got %v", err)
	}
}

func TestListByTopic_Empty(t *testing.T) {
	repo := &mockRepo{
		listByTopicFn: func(_ context.Context, _, _ string) ([]note.Note, error) {
			return nil, nil
		},
	}
	uc := note.NewUseCase(repo)

	result, err := uc.ListByTopic(context.Background(), "user-1", "topic-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 notes, got %d", len(result))
	}
}

func TestListByTopic_WithNotes(t *testing.T) {
	repo := &mockRepo{
		listByTopicFn: func(_ context.Context, _, _ string) ([]note.Note, error) {
			return []note.Note{
				{ID: "n1", Title: "First"},
				{ID: "n2", Title: "Second"},
			}, nil
		},
	}
	uc := note.NewUseCase(repo)

	result, err := uc.ListByTopic(context.Background(), "user-1", "topic-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Errorf("expected 2 notes, got %d", len(result))
	}
}

func TestUpdate_Success(t *testing.T) {
	repo := &mockRepo{
		updateFn: func(_ context.Context, _, _, title, content string) (note.Note, error) {
			return note.Note{
				ID:      "note-1",
				Title:   title,
				Content: content,
			}, nil
		},
	}
	uc := note.NewUseCase(repo)

	resp, err := uc.Update(context.Background(), "user-1", "note-1", note.UpdateNoteRequest{
		Title:   "Updated",
		Content: "New content",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Title != "Updated" {
		t.Errorf("expected title 'Updated', got %s", resp.Title)
	}
}

func TestUpdate_NotFound(t *testing.T) {
	repo := &mockRepo{
		updateFn: func(_ context.Context, _, _, _, _ string) (note.Note, error) {
			return note.Note{}, note.ErrNoteNotFound
		},
	}
	uc := note.NewUseCase(repo)

	_, err := uc.Update(context.Background(), "user-1", "missing", note.UpdateNoteRequest{})
	if !errors.Is(err, note.ErrNoteNotFound) {
		t.Fatalf("expected ErrNoteNotFound, got %v", err)
	}
}

func TestDelete_Success(t *testing.T) {
	repo := &mockRepo{
		deleteFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	}
	uc := note.NewUseCase(repo)

	err := uc.Delete(context.Background(), "user-1", "note-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDelete_NotFound(t *testing.T) {
	repo := &mockRepo{
		deleteFn: func(_ context.Context, _, _ string) error {
			return note.ErrNoteNotFound
		},
	}
	uc := note.NewUseCase(repo)

	err := uc.Delete(context.Background(), "user-1", "missing")
	if !errors.Is(err, note.ErrNoteNotFound) {
		t.Fatalf("expected ErrNoteNotFound, got %v", err)
	}
}
