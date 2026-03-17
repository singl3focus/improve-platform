package roadmap_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"improve-platform/internal/roadmap"
)

// mockRepo implements roadmap.Repository for unit tests.
type mockRepo struct {
	createRoadmapFn      func(ctx context.Context, userID, title string) (roadmap.Roadmap, error)
	getRoadmapByUserIDFn func(ctx context.Context, userID string) (roadmap.Roadmap, error)
	updateRoadmapTitleFn func(ctx context.Context, userID, title string) error
	createTopicFn        func(ctx context.Context, userID, title, description string, position int) (roadmap.Topic, error)
	createTopicWithDepFn func(ctx context.Context, userID, title, description string, position int, dependsOnTopicID string) (roadmap.Topic, error)
	getTopicByIDFn       func(ctx context.Context, id, userID string) (roadmap.Topic, error)
	getTopicsByUserIDFn  func(ctx context.Context, userID string) ([]roadmap.Topic, error)
	updateTopicFn        func(ctx context.Context, id, userID, title, description string, startDate, targetDate *time.Time, position int) error
	updateTopicStatusFn  func(ctx context.Context, id, userID, status string, startDate, completedDate *time.Time) error
	deleteTopicFn        func(ctx context.Context, id, userID string) error
	addDependencyFn      func(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	removeDependencyFn   func(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	getDependenciesFn    func(ctx context.Context, userID string) ([]roadmap.TopicDep, error)
	getTopicMetricsFn    func(ctx context.Context, userID string) (map[string]roadmap.TopicMetrics, error)
}

func (m *mockRepo) CreateRoadmap(ctx context.Context, userID, title string) (roadmap.Roadmap, error) {
	return m.createRoadmapFn(ctx, userID, title)
}
func (m *mockRepo) GetRoadmapByUserID(ctx context.Context, userID string) (roadmap.Roadmap, error) {
	return m.getRoadmapByUserIDFn(ctx, userID)
}
func (m *mockRepo) UpdateRoadmapTitle(ctx context.Context, userID, title string) error {
	return m.updateRoadmapTitleFn(ctx, userID, title)
}
func (m *mockRepo) CreateTopic(ctx context.Context, userID, title, description string, position int) (roadmap.Topic, error) {
	return m.createTopicFn(ctx, userID, title, description, position)
}
func (m *mockRepo) CreateTopicWithDependency(ctx context.Context, userID, title, description string, position int, dependsOnTopicID string) (roadmap.Topic, error) {
	return m.createTopicWithDepFn(ctx, userID, title, description, position, dependsOnTopicID)
}
func (m *mockRepo) GetTopicByID(ctx context.Context, id, userID string) (roadmap.Topic, error) {
	return m.getTopicByIDFn(ctx, id, userID)
}
func (m *mockRepo) GetTopicsByUserID(ctx context.Context, userID string) ([]roadmap.Topic, error) {
	return m.getTopicsByUserIDFn(ctx, userID)
}
func (m *mockRepo) UpdateTopic(ctx context.Context, id, userID, title, description string, startDate, targetDate *time.Time, position int) error {
	return m.updateTopicFn(ctx, id, userID, title, description, startDate, targetDate, position)
}
func (m *mockRepo) UpdateTopicStatus(ctx context.Context, id, userID, status string, startDate, completedDate *time.Time) error {
	return m.updateTopicStatusFn(ctx, id, userID, status, startDate, completedDate)
}
func (m *mockRepo) DeleteTopic(ctx context.Context, id, userID string) error {
	return m.deleteTopicFn(ctx, id, userID)
}
func (m *mockRepo) AddDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error {
	return m.addDependencyFn(ctx, topicID, dependsOnTopicID, userID)
}
func (m *mockRepo) RemoveDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error {
	return m.removeDependencyFn(ctx, topicID, dependsOnTopicID, userID)
}
func (m *mockRepo) GetDependenciesByUserID(ctx context.Context, userID string) ([]roadmap.TopicDep, error) {
	return m.getDependenciesFn(ctx, userID)
}
func (m *mockRepo) GetTopicMetricsByUserID(ctx context.Context, userID string) (map[string]roadmap.TopicMetrics, error) {
	return m.getTopicMetricsFn(ctx, userID)
}

// --- DAG cycle detection tests ---

func TestAddDependency_SelfReference(t *testing.T) {
	repo := &mockRepo{}
	uc := roadmap.NewUseCase(repo)

	err := uc.AddDependency(context.Background(), "user-1", "topic-A", roadmap.AddDependencyRequest{
		DependsOnTopicID: "topic-A",
	})
	if !errors.Is(err, roadmap.ErrSelfDependency) {
		t.Fatalf("expected ErrSelfDependency, got %v", err)
	}
}

func TestAddDependency_DirectCycle(t *testing.T) {
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, id, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: id, Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return []roadmap.TopicDep{
				{TopicID: "A", DependsOnTopicID: "B", UserID: "user-1"},
			}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.AddDependency(context.Background(), "user-1", "B", roadmap.AddDependencyRequest{
		DependsOnTopicID: "A",
	})
	if !errors.Is(err, roadmap.ErrCycleDetected) {
		t.Fatalf("expected ErrCycleDetected, got %v", err)
	}
}

func TestAddDependency_TransitiveCycle(t *testing.T) {
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, id, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: id, Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return []roadmap.TopicDep{
				{TopicID: "A", DependsOnTopicID: "B", UserID: "u"},
				{TopicID: "B", DependsOnTopicID: "C", UserID: "u"},
			}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.AddDependency(context.Background(), "u", "C", roadmap.AddDependencyRequest{
		DependsOnTopicID: "A",
	})
	if !errors.Is(err, roadmap.ErrCycleDetected) {
		t.Fatalf("expected ErrCycleDetected, got %v", err)
	}
}

func TestAddDependency_NoCycle(t *testing.T) {
	var addedTopic, addedDep string
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, id, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: id, Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return []roadmap.TopicDep{
				{TopicID: "A", DependsOnTopicID: "B", UserID: "u"},
			}, nil
		},
		addDependencyFn: func(_ context.Context, topicID, depID, _ string) error {
			addedTopic = topicID
			addedDep = depID
			return nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.AddDependency(context.Background(), "u", "C", roadmap.AddDependencyRequest{
		DependsOnTopicID: "A",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if addedTopic != "C" || addedDep != "A" {
		t.Errorf("expected dependency C→A, got %s→%s", addedTopic, addedDep)
	}
}

func TestAddDependency_Duplicate(t *testing.T) {
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, id, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: id, Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return nil, nil
		},
		addDependencyFn: func(_ context.Context, _, _, _ string) error {
			return roadmap.ErrDependencyExists
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.AddDependency(context.Background(), "u", "C", roadmap.AddDependencyRequest{DependsOnTopicID: "A"})
	if !errors.Is(err, roadmap.ErrDependencyExists) {
		t.Fatalf("expected ErrDependencyExists, got %v", err)
	}
}

func TestAddDependency_TopicNotFound(t *testing.T) {
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, id, _ string) (roadmap.Topic, error) {
			if id == "missing" {
				return roadmap.Topic{}, roadmap.ErrTopicNotFound
			}
			return roadmap.Topic{ID: id, Status: "not_started"}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.AddDependency(context.Background(), "u", "missing", roadmap.AddDependencyRequest{DependsOnTopicID: "A"})
	if !errors.Is(err, roadmap.ErrTopicNotFound) {
		t.Fatalf("expected ErrTopicNotFound, got %v", err)
	}
}

func TestRemoveDependency_NotFound(t *testing.T) {
	repo := &mockRepo{
		removeDependencyFn: func(_ context.Context, _, _, _ string) error {
			return roadmap.ErrDependencyNotFound
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.RemoveDependency(context.Background(), "u", "A", "B")
	if !errors.Is(err, roadmap.ErrDependencyNotFound) {
		t.Fatalf("expected ErrDependencyNotFound, got %v", err)
	}
}

func TestCreateTopicWithDependency_Success(t *testing.T) {
	var createdTopicID string
	var createdDependsOn string

	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, id, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: id}, nil
		},
		createTopicWithDepFn: func(_ context.Context, _ string, title, description string, position int, dependsOnTopicID string) (roadmap.Topic, error) {
			createdDependsOn = dependsOnTopicID
			return roadmap.Topic{
				ID:          "topic-new",
				Title:       title,
				Description: description,
				Status:      "not_started",
				Position:    position,
			}, nil
		},
	}

	uc := roadmap.NewUseCase(repo)
	resp, err := uc.CreateTopicWithDependency(context.Background(), "u", roadmap.CreateTopicWithDependencyRequest{
		Title:            "Child topic",
		Description:      "desc",
		Position:         2,
		DependsOnTopicID: "topic-parent",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	createdTopicID = resp.ID
	if createdTopicID != "topic-new" {
		t.Fatalf("expected topic id topic-new, got %s", createdTopicID)
	}
	if createdDependsOn != "topic-parent" {
		t.Fatalf("expected depends_on topic-parent, got %s", createdDependsOn)
	}
	if len(resp.Dependencies) != 1 || resp.Dependencies[0] != "topic-parent" {
		t.Fatalf("expected dependencies [topic-parent], got %v", resp.Dependencies)
	}
}

func TestCreateTopicWithDependency_RollbackOnDependencyInsertError(t *testing.T) {
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, id, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: id}, nil
		},
		createTopicWithDepFn: func(_ context.Context, _ string, _, _ string, _ int, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{}, roadmap.ErrDependencyExists
		},
	}

	uc := roadmap.NewUseCase(repo)
	_, err := uc.CreateTopicWithDependency(context.Background(), "u", roadmap.CreateTopicWithDependencyRequest{
		Title:            "Child topic",
		DependsOnTopicID: "topic-parent",
	})
	if !errors.Is(err, roadmap.ErrDependencyExists) {
		t.Fatalf("expected ErrDependencyExists, got %v", err)
	}
}

// --- Status transition tests ---

func TestUpdateTopicStatus_ToInProgress_Unblocked(t *testing.T) {
	var updatedStatus string
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, _ string, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: "t1", Status: "not_started"}, nil
		},
		getTopicsByUserIDFn: func(_ context.Context, _ string) ([]roadmap.Topic, error) {
			return []roadmap.Topic{
				{ID: "t1", Status: "not_started"},
				{ID: "t2", Status: "completed"},
			}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return []roadmap.TopicDep{
				{TopicID: "t1", DependsOnTopicID: "t2", UserID: "u"},
			}, nil
		},
		updateTopicStatusFn: func(_ context.Context, _, _, status string, _, _ *time.Time) error {
			updatedStatus = status
			return nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.UpdateTopicStatus(context.Background(), "u", "t1", roadmap.UpdateStatusRequest{Status: "in_progress"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedStatus != "in_progress" {
		t.Errorf("expected status 'in_progress', got %s", updatedStatus)
	}
}

func TestUpdateTopicStatus_ToInProgress_Blocked(t *testing.T) {
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, _ string, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: "t1", Status: "not_started"}, nil
		},
		getTopicsByUserIDFn: func(_ context.Context, _ string) ([]roadmap.Topic, error) {
			return []roadmap.Topic{
				{ID: "t1", Status: "not_started"},
				{ID: "t2", Status: "not_started"},
			}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return []roadmap.TopicDep{
				{TopicID: "t1", DependsOnTopicID: "t2", UserID: "u"},
			}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.UpdateTopicStatus(context.Background(), "u", "t1", roadmap.UpdateStatusRequest{Status: "in_progress"})
	if !errors.Is(err, roadmap.ErrTopicBlocked) {
		t.Fatalf("expected ErrTopicBlocked, got %v", err)
	}
}

func TestUpdateTopicStatus_InvalidTransition(t *testing.T) {
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, _ string, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: "t1", Status: "not_started"}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.UpdateTopicStatus(context.Background(), "u", "t1", roadmap.UpdateStatusRequest{Status: "completed"})
	if !errors.Is(err, roadmap.ErrInvalidStatus) {
		t.Fatalf("expected ErrInvalidStatus, got %v", err)
	}
}

func TestUpdateTopicStatus_ToCompleted(t *testing.T) {
	var gotCompletedDate *time.Time
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, _ string, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: "t1", Status: "in_progress"}, nil
		},
		updateTopicStatusFn: func(_ context.Context, _, _, _ string, _ *time.Time, cd *time.Time) error {
			gotCompletedDate = cd
			return nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.UpdateTopicStatus(context.Background(), "u", "t1", roadmap.UpdateStatusRequest{Status: "completed"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotCompletedDate == nil {
		t.Error("expected completed_date to be set")
	}
}

func TestUpdateTopicStatus_ToInProgress_SetsStartDate(t *testing.T) {
	var gotStartDate *time.Time
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, _ string, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: "t1", Status: "not_started", StartDate: nil}, nil
		},
		getTopicsByUserIDFn: func(_ context.Context, _ string) ([]roadmap.Topic, error) {
			return []roadmap.Topic{{ID: "t1", Status: "not_started"}}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return nil, nil
		},
		updateTopicStatusFn: func(_ context.Context, _, _, _ string, sd, _ *time.Time) error {
			gotStartDate = sd
			return nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	err := uc.UpdateTopicStatus(context.Background(), "u", "t1", roadmap.UpdateStatusRequest{Status: "in_progress"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotStartDate == nil {
		t.Error("expected start_date to be set on first in_progress transition")
	}
}

// --- GetFullRoadmap with blockage info ---

func TestGetFullRoadmap_WithBlockageInfo(t *testing.T) {
	repo := &mockRepo{
		getRoadmapByUserIDFn: func(_ context.Context, _ string) (roadmap.Roadmap, error) {
			return roadmap.Roadmap{ID: "rm-1", Title: "My Roadmap"}, nil
		},
		getTopicsByUserIDFn: func(_ context.Context, _ string) ([]roadmap.Topic, error) {
			return []roadmap.Topic{
				{ID: "t1", Title: "Topic A", Status: "not_started"},
				{ID: "t2", Title: "Topic B", Status: "not_started"},
			}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return []roadmap.TopicDep{
				{TopicID: "t2", DependsOnTopicID: "t1", UserID: "u"},
			}, nil
		},
		getTopicMetricsFn: func(_ context.Context, _ string) (map[string]roadmap.TopicMetrics, error) {
			return map[string]roadmap.TopicMetrics{
				"t1": {TopicID: "t1", TasksCount: 0, MaterialsCount: 1, ProgressPercent: 0},
				"t2": {TopicID: "t2", TasksCount: 3, MaterialsCount: 2, ProgressPercent: 66},
			}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	resp, err := uc.GetFullRoadmap(context.Background(), "u")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.Topics) != 2 {
		t.Fatalf("expected 2 topics, got %d", len(resp.Topics))
	}

	topicA := resp.Topics[0]
	if topicA.IsBlocked {
		t.Error("Topic A should not be blocked (no dependencies)")
	}
	if topicA.TasksCount != 0 || topicA.MaterialsCount != 1 || topicA.ProgressPercent != 0 {
		t.Errorf("unexpected metrics for topic A: tasks=%d materials=%d progress=%d", topicA.TasksCount, topicA.MaterialsCount, topicA.ProgressPercent)
	}

	topicB := resp.Topics[1]
	if !topicB.IsBlocked {
		t.Error("Topic B should be blocked (depends on incomplete Topic A)")
	}
	if len(topicB.BlockReasons) == 0 {
		t.Error("Topic B should have block reasons")
	}
	if len(topicB.Dependencies) != 1 || topicB.Dependencies[0] != "t1" {
		t.Errorf("Topic B dependencies should be [t1], got %v", topicB.Dependencies)
	}
	if topicB.TasksCount != 3 || topicB.MaterialsCount != 2 || topicB.ProgressPercent != 66 {
		t.Errorf("unexpected metrics for topic B: tasks=%d materials=%d progress=%d", topicB.TasksCount, topicB.MaterialsCount, topicB.ProgressPercent)
	}
}

func TestGetFullRoadmap_MetricsZeroValuesWhenMissing(t *testing.T) {
	repo := &mockRepo{
		getRoadmapByUserIDFn: func(_ context.Context, _ string) (roadmap.Roadmap, error) {
			return roadmap.Roadmap{ID: "rm-1", Title: "My Roadmap"}, nil
		},
		getTopicsByUserIDFn: func(_ context.Context, _ string) ([]roadmap.Topic, error) {
			return []roadmap.Topic{{ID: "t1", Title: "Topic A", Status: "not_started"}}, nil
		},
		getDependenciesFn: func(_ context.Context, _ string) ([]roadmap.TopicDep, error) {
			return nil, nil
		},
		getTopicMetricsFn: func(_ context.Context, _ string) (map[string]roadmap.TopicMetrics, error) {
			return map[string]roadmap.TopicMetrics{}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	resp, err := uc.GetFullRoadmap(context.Background(), "u")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	topic := resp.Topics[0]
	if topic.TasksCount != 0 || topic.MaterialsCount != 0 || topic.ProgressPercent != 0 {
		t.Errorf("expected zero metrics, got tasks=%d materials=%d progress=%d", topic.TasksCount, topic.MaterialsCount, topic.ProgressPercent)
	}
}
