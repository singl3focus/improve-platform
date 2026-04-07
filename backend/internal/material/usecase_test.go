package material_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/singl3focus/improve-platform/internal/material"
)

// mockRepo implements material.Repository for unit tests.
type mockRepo struct {
	createFn      func(ctx context.Context, m material.Material) (material.Material, error)
	getByIDFn     func(ctx context.Context, id, userID string) (material.Material, error)
	listByTopicFn func(ctx context.Context, topicID, userID string) ([]material.Material, error)
	updateFn      func(ctx context.Context, id, userID, title, description, url, materialType, unit string, totalAmount, completedAmount, position int) error
	deleteFn      func(ctx context.Context, id, userID string) error
}

func (m *mockRepo) Create(ctx context.Context, mat material.Material) (material.Material, error) {
	return m.createFn(ctx, mat)
}
func (m *mockRepo) GetByID(ctx context.Context, id, userID string) (material.Material, error) {
	return m.getByIDFn(ctx, id, userID)
}
func (m *mockRepo) ListByTopic(ctx context.Context, topicID, userID string) ([]material.Material, error) {
	return m.listByTopicFn(ctx, topicID, userID)
}
func (m *mockRepo) Update(ctx context.Context, id, userID, title, description, url, materialType, unit string, totalAmount, completedAmount, position int) error {
	return m.updateFn(ctx, id, userID, title, description, url, materialType, unit, totalAmount, completedAmount, position)
}
func (m *mockRepo) Delete(ctx context.Context, id, userID string) error {
	return m.deleteFn(ctx, id, userID)
}

// --- CreateMaterial tests ---

func TestCreateMaterial_Success(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, m material.Material) (material.Material, error) {
			m.ID = "mat-1"
			m.CreatedAt = time.Now()
			m.UpdatedAt = time.Now()
			return m, nil
		},
	}
	uc := material.NewUseCase(repo)

	resp, err := uc.CreateMaterial(context.Background(), "user-1", material.CreateRequest{
		TopicID:         "topic-1",
		Title:           "Go Book",
		Type:            "book",
		TotalAmount:     120,
		CompletedAmount: 0,
		Position:        1,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ID != "mat-1" {
		t.Errorf("expected ID mat-1, got %s", resp.ID)
	}
	if resp.Title != "Go Book" {
		t.Errorf("expected title 'Go Book', got %s", resp.Title)
	}
	if resp.Unit != "pages" {
		t.Errorf("expected unit pages, got %s", resp.Unit)
	}
}

func TestCreateMaterial_InvalidType(t *testing.T) {
	uc := material.NewUseCase(&mockRepo{})

	_, err := uc.CreateMaterial(context.Background(), "user-1", material.CreateRequest{
		TopicID:         "topic-1",
		Title:           "Book",
		Type:            "podcast",
		TotalAmount:     10,
		CompletedAmount: 1,
	})
	if !errors.Is(err, material.ErrInvalidMaterialType) {
		t.Errorf("expected ErrInvalidMaterialType, got %v", err)
	}
}

func TestCreateMaterial_InvalidAmount_CompletedOverTotal(t *testing.T) {
	uc := material.NewUseCase(&mockRepo{})

	_, err := uc.CreateMaterial(context.Background(), "user-1", material.CreateRequest{
		TopicID:         "topic-1",
		Title:           "Book",
		Type:            "article",
		TotalAmount:     10,
		CompletedAmount: 11,
	})
	if !errors.Is(err, material.ErrInvalidAmount) {
		t.Errorf("expected ErrInvalidAmount, got %v", err)
	}
}

func TestCreateMaterial_TopicNotFound(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, _ material.Material) (material.Material, error) {
			return material.Material{}, material.ErrTopicNotFound
		},
	}
	uc := material.NewUseCase(repo)

	_, err := uc.CreateMaterial(context.Background(), "user-1", material.CreateRequest{
		TopicID:         "bad-topic",
		Title:           "Book",
		Type:            "book",
		TotalAmount:     10,
		CompletedAmount: 0,
	})
	if !errors.Is(err, material.ErrTopicNotFound) {
		t.Errorf("expected ErrTopicNotFound, got %v", err)
	}
}

// --- GetMaterial tests ---

func TestGetMaterial_Success(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, id, _ string) (material.Material, error) {
			return material.Material{ID: id, Title: "Go Book", Type: "course", Unit: "lessons", TotalAmount: 8, CompletedAmount: 4}, nil
		},
	}
	uc := material.NewUseCase(repo)

	resp, err := uc.GetMaterial(context.Background(), "user-1", "mat-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Progress != 50 {
		t.Errorf("expected progress 50, got %d", resp.Progress)
	}
	if resp.Unit != "lessons" {
		t.Errorf("expected unit lessons, got %s", resp.Unit)
	}
}

func TestGetMaterial_NotFound(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (material.Material, error) {
			return material.Material{}, material.ErrMaterialNotFound
		},
	}
	uc := material.NewUseCase(repo)

	_, err := uc.GetMaterial(context.Background(), "user-1", "nonexistent")
	if !errors.Is(err, material.ErrMaterialNotFound) {
		t.Errorf("expected ErrMaterialNotFound, got %v", err)
	}
}

// --- ListByTopic tests ---

func TestListByTopic_Success(t *testing.T) {
	repo := &mockRepo{
		listByTopicFn: func(_ context.Context, _, _ string) ([]material.Material, error) {
			return []material.Material{
				{ID: "m1", Title: "Book A", Position: 0},
				{ID: "m2", Title: "Book B", Position: 1},
			}, nil
		},
	}
	uc := material.NewUseCase(repo)

	resp, err := uc.ListByTopic(context.Background(), "user-1", "topic-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp) != 2 {
		t.Errorf("expected 2 materials, got %d", len(resp))
	}
	if resp[0].Position != 0 || resp[1].Position != 1 {
		t.Error("expected materials ordered by position")
	}
}

func TestListByTopic_Empty(t *testing.T) {
	repo := &mockRepo{
		listByTopicFn: func(_ context.Context, _, _ string) ([]material.Material, error) {
			return nil, nil
		},
	}
	uc := material.NewUseCase(repo)

	resp, err := uc.ListByTopic(context.Background(), "user-1", "topic-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp) != 0 {
		t.Errorf("expected 0 materials, got %d", len(resp))
	}
}

// --- UpdateMaterial tests ---

func TestUpdateMaterial_Success(t *testing.T) {
	repo := &mockRepo{
		updateFn: func(_ context.Context, _, _, _, _, _, materialType, unit string, totalAmount, completedAmount, _ int) error {
			if materialType != "video" {
				t.Errorf("expected type video, got %s", materialType)
			}
			if unit != "hours" {
				t.Errorf("expected unit hours, got %s", unit)
			}
			if totalAmount != 10 || completedAmount != 7 {
				t.Errorf("expected amounts 10/7, got %d/%d", totalAmount, completedAmount)
			}
			return nil
		},
	}
	uc := material.NewUseCase(repo)

	err := uc.UpdateMaterial(context.Background(), "user-1", "mat-1", material.UpdateRequest{
		Title:           "Updated",
		Type:            "video",
		TotalAmount:     10,
		CompletedAmount: 7,
		Position:        2,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUpdateMaterial_InvalidAmount(t *testing.T) {
	uc := material.NewUseCase(&mockRepo{})

	err := uc.UpdateMaterial(context.Background(), "user-1", "mat-1", material.UpdateRequest{
		Title:           "X",
		Type:            "book",
		TotalAmount:     5,
		CompletedAmount: 6,
	})
	if !errors.Is(err, material.ErrInvalidAmount) {
		t.Errorf("expected ErrInvalidAmount, got %v", err)
	}
}

func TestUpdateMaterial_NotFound(t *testing.T) {
	repo := &mockRepo{
		updateFn: func(_ context.Context, _, _, _, _, _, _, _ string, _, _, _ int) error {
			return material.ErrMaterialNotFound
		},
	}
	uc := material.NewUseCase(repo)

	err := uc.UpdateMaterial(context.Background(), "user-1", "nonexistent", material.UpdateRequest{
		Title:           "X",
		Type:            "book",
		TotalAmount:     10,
		CompletedAmount: 1,
	})
	if !errors.Is(err, material.ErrMaterialNotFound) {
		t.Errorf("expected ErrMaterialNotFound, got %v", err)
	}
}

func TestBuildResponse_ZeroTotalAmount_ProgressZero(t *testing.T) {
	resp, err := material.NewUseCase(&mockRepo{
		getByIDFn: func(_ context.Context, id, _ string) (material.Material, error) {
			return material.Material{ID: id, Type: "book", Unit: "pages", TotalAmount: 0, CompletedAmount: 0}, nil
		},
	}).GetMaterial(context.Background(), "user-1", "mat-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Progress != 0 {
		t.Errorf("expected progress 0, got %d", resp.Progress)
	}
}

// --- DeleteMaterial tests ---

func TestDeleteMaterial_Success(t *testing.T) {
	repo := &mockRepo{
		deleteFn: func(_ context.Context, _, _ string) error {
			return nil
		},
	}
	uc := material.NewUseCase(repo)

	err := uc.DeleteMaterial(context.Background(), "user-1", "mat-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDeleteMaterial_NotFound(t *testing.T) {
	repo := &mockRepo{
		deleteFn: func(_ context.Context, _, _ string) error {
			return material.ErrMaterialNotFound
		},
	}
	uc := material.NewUseCase(repo)

	err := uc.DeleteMaterial(context.Background(), "user-1", "nonexistent")
	if !errors.Is(err, material.ErrMaterialNotFound) {
		t.Errorf("expected ErrMaterialNotFound, got %v", err)
	}
}
