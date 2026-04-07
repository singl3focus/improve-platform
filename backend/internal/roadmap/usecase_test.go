package roadmap_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/singl3focus/improve-platform/internal/roadmap"
)

// mockRepo implements roadmap.Repository for unit tests.
type mockRepo struct {
	createRoadmapFn          func(ctx context.Context, userID, title string, roadmapType roadmap.RoadmapType) (roadmap.Roadmap, error)
	getRoadmapByUserIDFn     func(ctx context.Context, userID string) (roadmap.Roadmap, error)
	getRoadmapByIDFn         func(ctx context.Context, id, userID string) (roadmap.Roadmap, error)
	listRoadmapsFn           func(ctx context.Context, userID string) ([]roadmap.Roadmap, error)
	updateRoadmapTitleFn     func(ctx context.Context, id, userID, title string) error
	deleteRoadmapFn          func(ctx context.Context, id, userID string) error
	createTopicFn            func(ctx context.Context, userID, roadmapID, title, description string, position int) (roadmap.Topic, error)
	createTopicDirectionalFn func(ctx context.Context, userID, roadmapID, currentTopicID, title, description string, direction roadmap.TopicCreateDirection) (roadmap.Topic, error)
	getTopicByIDFn           func(ctx context.Context, id, userID string) (roadmap.Topic, error)
	getTopicsByRoadmapIDFn   func(ctx context.Context, roadmapID, userID string) ([]roadmap.Topic, error)
	updateTopicFn            func(ctx context.Context, id, userID, title, description string, startDate, targetDate *time.Time, position int) error
	setTopicConfidenceFn     func(ctx context.Context, id, userID string, confidence int) error
	updateTopicStatusFn      func(ctx context.Context, id, userID, status string, startDate, completedDate *time.Time) error
	deleteTopicFn            func(ctx context.Context, id, userID string) error
	addDependencyFn          func(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	removeDependencyFn       func(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	getDependenciesFn        func(ctx context.Context, roadmapID, userID string) ([]roadmap.TopicDep, error)
	getTopicMetricsFn        func(ctx context.Context, roadmapID, userID string) (map[string]roadmap.TopicMetrics, error)
}

func (m *mockRepo) CreateRoadmap(ctx context.Context, userID, title string, roadmapType roadmap.RoadmapType) (roadmap.Roadmap, error) {
	return m.createRoadmapFn(ctx, userID, title, roadmapType)
}
func (m *mockRepo) GetRoadmapByUserID(ctx context.Context, userID string) (roadmap.Roadmap, error) {
	return m.getRoadmapByUserIDFn(ctx, userID)
}
func (m *mockRepo) GetRoadmapByID(ctx context.Context, id, userID string) (roadmap.Roadmap, error) {
	if m.getRoadmapByIDFn != nil {
		return m.getRoadmapByIDFn(ctx, id, userID)
	}
	return roadmap.Roadmap{ID: id}, nil
}
func (m *mockRepo) ListRoadmaps(ctx context.Context, userID string) ([]roadmap.Roadmap, error) {
	if m.listRoadmapsFn != nil {
		return m.listRoadmapsFn(ctx, userID)
	}
	return nil, nil
}
func (m *mockRepo) UpdateRoadmapTitle(ctx context.Context, id, userID, title string) error {
	if m.updateRoadmapTitleFn != nil {
		return m.updateRoadmapTitleFn(ctx, id, userID, title)
	}
	return nil
}
func (m *mockRepo) DeleteRoadmap(ctx context.Context, id, userID string) error {
	if m.deleteRoadmapFn != nil {
		return m.deleteRoadmapFn(ctx, id, userID)
	}
	return nil
}
func (m *mockRepo) CreateTopic(ctx context.Context, userID, roadmapID, title, description string, position int) (roadmap.Topic, error) {
	return m.createTopicFn(ctx, userID, roadmapID, title, description, position)
}
func (m *mockRepo) CreateTopicDirectional(ctx context.Context, userID, roadmapID, currentTopicID, title, description string, direction roadmap.TopicCreateDirection) (roadmap.Topic, error) {
	return m.createTopicDirectionalFn(ctx, userID, roadmapID, currentTopicID, title, description, direction)
}
func (m *mockRepo) GetTopicByID(ctx context.Context, id, userID string) (roadmap.Topic, error) {
	return m.getTopicByIDFn(ctx, id, userID)
}
func (m *mockRepo) GetTopicsByRoadmapID(ctx context.Context, roadmapID, userID string) ([]roadmap.Topic, error) {
	return m.getTopicsByRoadmapIDFn(ctx, roadmapID, userID)
}
func (m *mockRepo) UpdateTopic(ctx context.Context, id, userID, title, description string, startDate, targetDate *time.Time, position int) error {
	return m.updateTopicFn(ctx, id, userID, title, description, startDate, targetDate, position)
}
func (m *mockRepo) SetTopicConfidence(ctx context.Context, id, userID string, confidence int) error {
	if m.setTopicConfidenceFn != nil {
		return m.setTopicConfidenceFn(ctx, id, userID, confidence)
	}
	return nil
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
func (m *mockRepo) GetDependenciesByRoadmapID(ctx context.Context, roadmapID, userID string) ([]roadmap.TopicDep, error) {
	return m.getDependenciesFn(ctx, roadmapID, userID)
}
func (m *mockRepo) GetTopicMetricsByRoadmapID(ctx context.Context, roadmapID, userID string) (map[string]roadmap.TopicMetrics, error) {
	return m.getTopicMetricsFn(ctx, roadmapID, userID)
}

func TestCreateTopic_DirectionalSuccess(t *testing.T) {
	called := false
	var depTopicID, depDependsOnID string
	repo := &mockRepo{
		createTopicDirectionalFn: func(_ context.Context, userID, _, currentTopicID, title, description string, direction roadmap.TopicCreateDirection) (roadmap.Topic, error) {
			called = true
			if userID != "u-1" || currentTopicID != "11111111-1111-1111-1111-111111111111" {
				t.Fatalf("unexpected ids: user=%s current=%s", userID, currentTopicID)
			}
			if direction != roadmap.TopicCreateDirectionBelow {
				t.Fatalf("unexpected direction: %s", direction)
			}
			if title != "Child" || description != "desc" {
				t.Fatalf("unexpected payload: %s / %s", title, description)
			}
			return roadmap.Topic{ID: "topic-new", Title: title, Description: description, Position: 4}, nil
		},
		addDependencyFn: func(_ context.Context, topicID, dependsOnTopicID, _ string) error {
			depTopicID = topicID
			depDependsOnID = dependsOnTopicID
			return nil
		},
	}

	uc := roadmap.NewUseCase(repo)
	resp, err := uc.CreateTopic(context.Background(), "u-1", "rm-1", roadmap.CreateTopicRequest{
		Title:             "Child",
		Description:       "desc",
		Direction:         roadmap.TopicCreateDirectionBelow,
		RelativeToTopicID: "11111111-1111-1111-1111-111111111111",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatal("expected directional repo method to be called")
	}
	if resp.ID != "topic-new" {
		t.Fatalf("expected topic-new, got %s", resp.ID)
	}
	if depTopicID != "topic-new" || depDependsOnID != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("expected dependency topic-new → 11111111-1111-1111-1111-111111111111, got %s → %s", depTopicID, depDependsOnID)
	}
	if len(resp.Dependencies) != 1 || resp.Dependencies[0] != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("expected response to include dependency, got %v", resp.Dependencies)
	}
}

func TestCreateRoadmap_WithType(t *testing.T) {
	var receivedType roadmap.RoadmapType
	repo := &mockRepo{
		createRoadmapFn: func(_ context.Context, userID, title string, roadmapType roadmap.RoadmapType) (roadmap.Roadmap, error) {
			if userID != "u-1" || title != "Typed roadmap" {
				t.Fatalf("unexpected create payload: %s / %s", userID, title)
			}
			receivedType = roadmapType
			return roadmap.Roadmap{
				ID:    "rm-1",
				Title: title,
				Type:  roadmapType,
			}, nil
		},
	}

	uc := roadmap.NewUseCase(repo)
	resp, err := uc.CreateRoadmap(context.Background(), "u-1", roadmap.CreateRoadmapRequest{
		Title: "Typed roadmap",
		Type:  roadmap.RoadmapTypeLevels,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receivedType != roadmap.RoadmapTypeLevels {
		t.Fatalf("expected levels type, got %s", receivedType)
	}
	if resp.Type != roadmap.RoadmapTypeLevels {
		t.Fatalf("expected response type levels, got %s", resp.Type)
	}
}

func TestCreateRoadmap_InvalidType(t *testing.T) {
	repo := &mockRepo{}
	uc := roadmap.NewUseCase(repo)

	_, err := uc.CreateRoadmap(context.Background(), "u-1", roadmap.CreateRoadmapRequest{
		Title: "Typed roadmap",
		Type:  roadmap.RoadmapType("invalid"),
	})
	if !errors.Is(err, roadmap.ErrInvalidRoadmapType) {
		t.Fatalf("expected ErrInvalidRoadmapType, got %v", err)
	}
}

func TestListRoadmaps_IncludesType(t *testing.T) {
	repo := &mockRepo{
		listRoadmapsFn: func(_ context.Context, userID string) ([]roadmap.Roadmap, error) {
			if userID != "u-1" {
				t.Fatalf("unexpected userID: %s", userID)
			}
			return []roadmap.Roadmap{
				{ID: "rm-1", Title: "Graph", Type: roadmap.RoadmapTypeGraph, TotalTopics: 4, CompletedTopics: 2},
				{ID: "rm-2", Title: "Levels", Type: roadmap.RoadmapTypeLevels, TotalTopics: 0, CompletedTopics: 0},
			}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	items, err := uc.ListRoadmaps(context.Background(), "u-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 roadmaps, got %d", len(items))
	}
	if items[0].Type != roadmap.RoadmapTypeGraph || items[1].Type != roadmap.RoadmapTypeLevels {
		t.Fatalf("unexpected roadmap types: %+v", items)
	}
}

func TestCreateTopic_DirectionalInvalidPayload(t *testing.T) {
	repo := &mockRepo{}
	uc := roadmap.NewUseCase(repo)

	_, err := uc.CreateTopic(context.Background(), "u-1", "rm-1", roadmap.CreateTopicRequest{
		Title:             "Child",
		Description:       "desc",
		Direction:         "diagonal",
		RelativeToTopicID: "11111111-1111-1111-1111-111111111111",
	})
	if !errors.Is(err, roadmap.ErrInvalidDirection) {
		t.Fatalf("expected ErrInvalidDirection, got %v", err)
	}
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
			return roadmap.Topic{ID: id, RoadmapID: "rm-1", Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _, _ string) ([]roadmap.TopicDep, error) {
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
			return roadmap.Topic{ID: id, RoadmapID: "rm-1", Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _, _ string) ([]roadmap.TopicDep, error) {
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
			return roadmap.Topic{ID: id, RoadmapID: "rm-1", Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _, _ string) ([]roadmap.TopicDep, error) {
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
			return roadmap.Topic{ID: id, RoadmapID: "rm-1", Status: "not_started"}, nil
		},
		getDependenciesFn: func(_ context.Context, _, _ string) ([]roadmap.TopicDep, error) {
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

// --- Status transition tests ---

func TestUpdateTopicStatus_ToInProgress(t *testing.T) {
	var updatedStatus string
	repo := &mockRepo{
		getTopicByIDFn: func(_ context.Context, _ string, _ string) (roadmap.Topic, error) {
			return roadmap.Topic{ID: "t1", Status: "not_started"}, nil
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
		getRoadmapByIDFn: func(_ context.Context, id, _ string) (roadmap.Roadmap, error) {
			return roadmap.Roadmap{ID: id, Title: "My Roadmap", Type: roadmap.RoadmapTypeCycles}, nil
		},
		getTopicsByRoadmapIDFn: func(_ context.Context, _, _ string) ([]roadmap.Topic, error) {
			return []roadmap.Topic{
				{ID: "t1", Title: "Topic A", Status: "not_started"},
				{ID: "t2", Title: "Topic B", Status: "not_started"},
			}, nil
		},
		getDependenciesFn: func(_ context.Context, _, _ string) ([]roadmap.TopicDep, error) {
			return []roadmap.TopicDep{
				{TopicID: "t2", DependsOnTopicID: "t1", UserID: "u"},
			}, nil
		},
		getTopicMetricsFn: func(_ context.Context, _, _ string) (map[string]roadmap.TopicMetrics, error) {
			return map[string]roadmap.TopicMetrics{
				"t1": {TopicID: "t1", TasksCount: 0, MaterialsCount: 1, ProgressPercent: 0},
				"t2": {TopicID: "t2", TasksCount: 3, MaterialsCount: 2, ProgressPercent: 66},
			}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	resp, err := uc.GetFullRoadmap(context.Background(), "u", "rm-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.Topics) != 2 {
		t.Fatalf("expected 2 topics, got %d", len(resp.Topics))
	}
	if resp.Type != roadmap.RoadmapTypeCycles {
		t.Fatalf("expected cycles type, got %s", resp.Type)
	}

	topicA := resp.Topics[0]
	if topicA.TasksCount != 0 || topicA.MaterialsCount != 1 || topicA.ProgressPercent != 0 {
		t.Errorf("unexpected metrics for topic A: tasks=%d materials=%d progress=%d", topicA.TasksCount, topicA.MaterialsCount, topicA.ProgressPercent)
	}

	topicB := resp.Topics[1]
	if len(topicB.Dependencies) != 1 || topicB.Dependencies[0] != "t1" {
		t.Errorf("Topic B dependencies should be [t1], got %v", topicB.Dependencies)
	}
	if topicB.TasksCount != 3 || topicB.MaterialsCount != 2 || topicB.ProgressPercent != 66 {
		t.Errorf("unexpected metrics for topic B: tasks=%d materials=%d progress=%d", topicB.TasksCount, topicB.MaterialsCount, topicB.ProgressPercent)
	}
}

func TestGetFullRoadmap_MetricsZeroValuesWhenMissing(t *testing.T) {
	repo := &mockRepo{
		getRoadmapByIDFn: func(_ context.Context, id, _ string) (roadmap.Roadmap, error) {
			return roadmap.Roadmap{ID: id, Title: "My Roadmap", Type: roadmap.RoadmapTypeGraph}, nil
		},
		getTopicsByRoadmapIDFn: func(_ context.Context, _, _ string) ([]roadmap.Topic, error) {
			return []roadmap.Topic{{ID: "t1", Title: "Topic A", Status: "not_started"}}, nil
		},
		getDependenciesFn: func(_ context.Context, _, _ string) ([]roadmap.TopicDep, error) {
			return nil, nil
		},
		getTopicMetricsFn: func(_ context.Context, _, _ string) (map[string]roadmap.TopicMetrics, error) {
			return map[string]roadmap.TopicMetrics{}, nil
		},
	}
	uc := roadmap.NewUseCase(repo)

	resp, err := uc.GetFullRoadmap(context.Background(), "u", "rm-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	topic := resp.Topics[0]
	if topic.TasksCount != 0 || topic.MaterialsCount != 0 || topic.ProgressPercent != 0 {
		t.Errorf("expected zero metrics, got tasks=%d materials=%d progress=%d", topic.TasksCount, topic.MaterialsCount, topic.ProgressPercent)
	}
}
