package history_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"improve-platform/internal/history"
)

type mockRepo struct {
	insertFn       func(ctx context.Context, event history.Event) error
	listByEntityFn func(ctx context.Context, userID, entityType, entityID string) ([]history.EventRecord, error)
	listByUserFn   func(ctx context.Context, userID string, entityType *string, limit, offset int) ([]history.EventRecord, error)
}

func (m *mockRepo) Insert(ctx context.Context, event history.Event) error {
	return m.insertFn(ctx, event)
}
func (m *mockRepo) ListByEntity(ctx context.Context, userID, entityType, entityID string) ([]history.EventRecord, error) {
	return m.listByEntityFn(ctx, userID, entityType, entityID)
}
func (m *mockRepo) ListByUser(ctx context.Context, userID string, entityType *string, limit, offset int) ([]history.EventRecord, error) {
	return m.listByUserFn(ctx, userID, entityType, limit, offset)
}

// --- Record tests ---

func TestRecord_Success(t *testing.T) {
	var recorded history.Event
	repo := &mockRepo{
		insertFn: func(_ context.Context, ev history.Event) error {
			recorded = ev
			return nil
		},
	}
	uc := history.NewUseCase(repo)

	err := uc.Record(context.Background(), history.Event{
		UserID:     "user-1",
		EntityType: "topic",
		EntityID:   "topic-1",
		EventType:  "business",
		EventName:  "topic.status_changed",
		Payload:    map[string]any{"old_status": "not_started", "new_status": "in_progress"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if recorded.EventName != "topic.status_changed" {
		t.Errorf("expected event_name 'topic.status_changed', got %s", recorded.EventName)
	}
	if recorded.EventType != "business" {
		t.Errorf("expected event_type 'business', got %s", recorded.EventType)
	}
}

func TestRecord_InsertError(t *testing.T) {
	repo := &mockRepo{
		insertFn: func(_ context.Context, _ history.Event) error {
			return errors.New("db error")
		},
	}
	uc := history.NewUseCase(repo)

	err := uc.Record(context.Background(), history.Event{
		UserID: "user-1", EntityType: "task", EntityID: "t-1",
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- GetEntityHistory tests ---

func TestGetEntityHistory_Success(t *testing.T) {
	now := time.Now()
	repo := &mockRepo{
		listByEntityFn: func(_ context.Context, _, _, _ string) ([]history.EventRecord, error) {
			return []history.EventRecord{
				{
					ID: "ev-1", UserID: "user-1",
					EntityType: "topic", EntityID: "topic-1",
					EventType: "business", EventName: "topic.status_changed",
					Payload:   map[string]any{"old_status": "not_started", "new_status": "in_progress"},
					CreatedAt: now,
				},
				{
					ID: "ev-2", UserID: "user-1",
					EntityType: "topic", EntityID: "topic-1",
					EventType: "technical", EventName: "entity.created",
					Payload:   map[string]any{"title": "My Topic"},
					CreatedAt: now.Add(-time.Hour),
				},
			}, nil
		},
	}
	uc := history.NewUseCase(repo)

	resp, err := uc.GetEntityHistory(context.Background(), "user-1", "topic", "topic-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp) != 2 {
		t.Fatalf("expected 2 events, got %d", len(resp))
	}
	if resp[0].EventName != "topic.status_changed" {
		t.Errorf("expected first event 'topic.status_changed', got %s", resp[0].EventName)
	}
	if resp[1].EventName != "entity.created" {
		t.Errorf("expected second event 'entity.created', got %s", resp[1].EventName)
	}
}

func TestGetEntityHistory_Empty(t *testing.T) {
	repo := &mockRepo{
		listByEntityFn: func(_ context.Context, _, _, _ string) ([]history.EventRecord, error) {
			return nil, nil
		},
	}
	uc := history.NewUseCase(repo)

	resp, err := uc.GetEntityHistory(context.Background(), "user-1", "topic", "nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp) != 0 {
		t.Errorf("expected 0 events, got %d", len(resp))
	}
}

func TestGetEntityHistory_RepoError(t *testing.T) {
	repo := &mockRepo{
		listByEntityFn: func(_ context.Context, _, _, _ string) ([]history.EventRecord, error) {
			return nil, errors.New("db error")
		},
	}
	uc := history.NewUseCase(repo)

	_, err := uc.GetEntityHistory(context.Background(), "user-1", "topic", "topic-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- GetUserHistory tests ---

func TestGetUserHistory_Success(t *testing.T) {
	repo := &mockRepo{
		listByUserFn: func(_ context.Context, _ string, _ *string, limit, offset int) ([]history.EventRecord, error) {
			if limit != 50 || offset != 0 {
				t.Errorf("expected default limit=50, offset=0; got limit=%d, offset=%d", limit, offset)
			}
			return []history.EventRecord{
				{ID: "ev-1", EntityType: "topic", EventName: "topic.status_changed"},
				{ID: "ev-2", EntityType: "task", EventName: "entity.created"},
			}, nil
		},
	}
	uc := history.NewUseCase(repo)

	resp, err := uc.GetUserHistory(context.Background(), "user-1", nil, 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp) != 2 {
		t.Errorf("expected 2 events, got %d", len(resp))
	}
}

func TestGetUserHistory_WithEntityTypeFilter(t *testing.T) {
	var gotEntityType *string
	repo := &mockRepo{
		listByUserFn: func(_ context.Context, _ string, entityType *string, _, _ int) ([]history.EventRecord, error) {
			gotEntityType = entityType
			return nil, nil
		},
	}
	uc := history.NewUseCase(repo)

	et := "topic"
	_, err := uc.GetUserHistory(context.Background(), "user-1", &et, 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotEntityType == nil || *gotEntityType != "topic" {
		t.Error("expected entity_type filter 'topic' to be passed to repo")
	}
}

func TestGetUserHistory_LimitClamped(t *testing.T) {
	var gotLimit int
	repo := &mockRepo{
		listByUserFn: func(_ context.Context, _ string, _ *string, limit, _ int) ([]history.EventRecord, error) {
			gotLimit = limit
			return nil, nil
		},
	}
	uc := history.NewUseCase(repo)

	_, _ = uc.GetUserHistory(context.Background(), "user-1", nil, 500, 0)
	if gotLimit != 200 {
		t.Errorf("expected limit clamped to 200, got %d", gotLimit)
	}
}

func TestGetUserHistory_NegativeOffset(t *testing.T) {
	var gotOffset int
	repo := &mockRepo{
		listByUserFn: func(_ context.Context, _ string, _ *string, _, offset int) ([]history.EventRecord, error) {
			gotOffset = offset
			return nil, nil
		},
	}
	uc := history.NewUseCase(repo)

	_, _ = uc.GetUserHistory(context.Background(), "user-1", nil, 10, -5)
	if gotOffset != 0 {
		t.Errorf("expected offset normalized to 0, got %d", gotOffset)
	}
}
