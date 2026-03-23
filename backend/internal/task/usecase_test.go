package task_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"improve-platform/internal/task"
)

// mockRepo implements task.Repository for unit tests.
type mockRepo struct {
	createFn       func(ctx context.Context, t task.Task) (task.Task, error)
	getByIDFn      func(ctx context.Context, id, userID string) (task.Task, error)
	listByUserFn   func(ctx context.Context, userID string, topicID *string) ([]task.Task, error)
	updateFn       func(ctx context.Context, id, userID, title, description string, deadline *time.Time, position int, topicID *string, updateTopicID bool) error
	updateStatusFn func(ctx context.Context, id, userID, status string) error
	deleteFn       func(ctx context.Context, id, userID string) error
	countByTopicFn func(ctx context.Context, topicID, userID string) (int, int, error)
}

func (m *mockRepo) Create(ctx context.Context, t task.Task) (task.Task, error) {
	return m.createFn(ctx, t)
}
func (m *mockRepo) GetByID(ctx context.Context, id, userID string) (task.Task, error) {
	return m.getByIDFn(ctx, id, userID)
}
func (m *mockRepo) ListByUser(ctx context.Context, userID string, topicID *string) ([]task.Task, error) {
	return m.listByUserFn(ctx, userID, topicID)
}
func (m *mockRepo) Update(
	ctx context.Context,
	id,
	userID,
	title,
	description string,
	deadline *time.Time,
	position int,
	topicID *string,
	updateTopicID bool,
) error {
	return m.updateFn(ctx, id, userID, title, description, deadline, position, topicID, updateTopicID)
}
func (m *mockRepo) UpdateStatus(ctx context.Context, id, userID, status string) error {
	return m.updateStatusFn(ctx, id, userID, status)
}
func (m *mockRepo) Delete(ctx context.Context, id, userID string) error {
	return m.deleteFn(ctx, id, userID)
}
func (m *mockRepo) CountByTopic(ctx context.Context, topicID, userID string) (int, int, error) {
	return m.countByTopicFn(ctx, topicID, userID)
}

// mockTopicUpdater implements task.TopicStatusUpdater for unit tests.
type mockTopicUpdater struct {
	getTopicStatusFn     func(ctx context.Context, topicID, userID string) (string, error)
	setTopicInProgressFn func(ctx context.Context, topicID, userID string) error
	setTopicCompletedFn  func(ctx context.Context, topicID, userID string) error
}

func (m *mockTopicUpdater) GetTopicStatus(ctx context.Context, topicID, userID string) (string, error) {
	return m.getTopicStatusFn(ctx, topicID, userID)
}
func (m *mockTopicUpdater) SetTopicInProgress(ctx context.Context, topicID, userID string) error {
	return m.setTopicInProgressFn(ctx, topicID, userID)
}
func (m *mockTopicUpdater) SetTopicCompleted(ctx context.Context, topicID, userID string) error {
	return m.setTopicCompletedFn(ctx, topicID, userID)
}

// --- CreateTask tests ---

func TestCreateTask_Standalone(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, tk task.Task) (task.Task, error) {
			tk.ID = "task-1"
			tk.Status = "new"
			return tk, nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	resp, err := uc.CreateTask(context.Background(), "user-1", task.CreateRequest{
		Title:       "Buy groceries",
		Description: "Milk, eggs",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ID != "task-1" {
		t.Errorf("expected ID task-1, got %s", resp.ID)
	}
	if resp.TopicID != nil {
		t.Errorf("expected nil topic_id for standalone task, got %v", resp.TopicID)
	}
	if resp.Status != "new" {
		t.Errorf("expected status 'new', got %s", resp.Status)
	}
}

func TestCreateTask_ChecklistItem(t *testing.T) {
	topicID := "topic-1"
	repo := &mockRepo{
		createFn: func(_ context.Context, tk task.Task) (task.Task, error) {
			tk.ID = "task-2"
			tk.Status = "new"
			return tk, nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	resp, err := uc.CreateTask(context.Background(), "user-1", task.CreateRequest{
		TopicID: &topicID,
		Title:   "Read chapter 1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.TopicID == nil || *resp.TopicID != "topic-1" {
		t.Errorf("expected topic_id 'topic-1', got %v", resp.TopicID)
	}
}

// --- Status transition tests ---

func TestUpdateTaskStatus_ValidTransition(t *testing.T) {
	var updatedStatus string
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "new"}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, status string) error {
			updatedStatus = status
			return nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "in_progress"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedStatus != "in_progress" {
		t.Errorf("expected 'in_progress', got %s", updatedStatus)
	}
}

func TestUpdateTaskStatus_ToDone_FromAnyActiveStatus(t *testing.T) {
	testCases := []struct {
		name       string
		fromStatus string
	}{
		{name: "from new", fromStatus: "new"},
		{name: "from in_progress", fromStatus: "in_progress"},
		{name: "from paused", fromStatus: "paused"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var updatedStatus string
			repo := &mockRepo{
				getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
					return task.Task{ID: "t1", Status: tc.fromStatus}, nil
				},
				updateStatusFn: func(_ context.Context, _, _, status string) error {
					updatedStatus = status
					return nil
				},
			}
			uc := task.NewUseCase(repo, &mockTopicUpdater{})

			err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "done"})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if updatedStatus != "done" {
				t.Errorf("expected 'done', got %s", updatedStatus)
			}
		})
	}
}

func TestUpdateTaskStatus_InvalidTransition(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "new"}, nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "paused"})
	if !errors.Is(err, task.ErrInvalidStatus) {
		t.Fatalf("expected ErrInvalidStatus, got %v", err)
	}
}

// --- Auto-complete topic tests ---

func TestUpdateTaskStatus_ToDone_AutoCompleteTopic(t *testing.T) {
	topicID := "topic-1"
	var topicCompleted bool

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "in_progress", TopicID: &topicID}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
		countByTopicFn: func(_ context.Context, _, _ string) (int, int, error) {
			return 3, 3, nil // all 3 tasks done (including the one just updated)
		},
	}
	topicUpdater := &mockTopicUpdater{
		getTopicStatusFn: func(_ context.Context, _, _ string) (string, error) {
			return "in_progress", nil
		},
		setTopicCompletedFn: func(_ context.Context, _, _ string) error {
			topicCompleted = true
			return nil
		},
	}
	uc := task.NewUseCase(repo, topicUpdater)

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "done"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !topicCompleted {
		t.Error("expected topic to be auto-completed when all checklist items are done")
	}
}

func TestUpdateTaskStatus_ToDone_TopicNotInProgress(t *testing.T) {
	topicID := "topic-1"
	var topicCompleted bool

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "in_progress", TopicID: &topicID}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
		countByTopicFn: func(_ context.Context, _, _ string) (int, int, error) {
			return 2, 2, nil
		},
	}
	topicUpdater := &mockTopicUpdater{
		getTopicStatusFn: func(_ context.Context, _, _ string) (string, error) {
			return "paused", nil // topic is paused, not in_progress
		},
		setTopicCompletedFn: func(_ context.Context, _, _ string) error {
			topicCompleted = true
			return nil
		},
	}
	uc := task.NewUseCase(repo, topicUpdater)

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "done"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if topicCompleted {
		t.Error("topic should NOT be auto-completed when topic status is not 'in_progress'")
	}
}

func TestUpdateTaskStatus_ToDone_StandaloneTask(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "in_progress", TopicID: nil}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
	}
	// topicUpdater methods should not be called for standalone tasks
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "done"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUpdateTaskStatus_ToDone_NotAllDone(t *testing.T) {
	topicID := "topic-1"
	var topicCompleted bool

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "in_progress", TopicID: &topicID}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
		countByTopicFn: func(_ context.Context, _, _ string) (int, int, error) {
			return 3, 2, nil // only 2 of 3 done
		},
	}
	topicUpdater := &mockTopicUpdater{
		getTopicStatusFn: func(_ context.Context, _, _ string) (string, error) {
			return "in_progress", nil
		},
		setTopicCompletedFn: func(_ context.Context, _, _ string) error {
			topicCompleted = true
			return nil
		},
	}
	uc := task.NewUseCase(repo, topicUpdater)

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "done"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if topicCompleted {
		t.Error("topic should NOT be auto-completed when not all tasks are done")
	}
}

// --- Topic progress tests ---

func TestGetTopicTasks_ProgressComputation(t *testing.T) {
	topicID := "topic-1"
	repo := &mockRepo{
		listByUserFn: func(_ context.Context, _ string, _ *string) ([]task.Task, error) {
			return []task.Task{
				{ID: "t1", TopicID: &topicID, Status: "done", Title: "Task 1"},
				{ID: "t2", TopicID: &topicID, Status: "done", Title: "Task 2"},
				{ID: "t3", TopicID: &topicID, Status: "new", Title: "Task 3"},
			}, nil
		},
		countByTopicFn: func(_ context.Context, _, _ string) (int, int, error) {
			return 3, 2, nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	resp, err := uc.GetTopicTasks(context.Background(), "user-1", "topic-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Total != 3 {
		t.Errorf("expected total=3, got %d", resp.Total)
	}
	if resp.Done != 2 {
		t.Errorf("expected done=2, got %d", resp.Done)
	}
	if resp.Percent != 66 { // 2*100/3 = 66 (integer division)
		t.Errorf("expected percent=66, got %d", resp.Percent)
	}
	if len(resp.Tasks) != 3 {
		t.Errorf("expected 3 tasks, got %d", len(resp.Tasks))
	}
}

// --- Overdue tests ---

func TestIsOverdue_PastDeadline(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Truncate(24 * time.Hour)
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{
				ID:       "t1",
				Status:   "in_progress",
				Deadline: &yesterday,
				Title:    "Overdue task",
			}, nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	resp, err := uc.GetTask(context.Background(), "user-1", "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.IsOverdue {
		t.Error("expected task to be overdue (deadline in the past)")
	}
}

func TestIsOverdue_NoDeadline(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{
				ID:       "t1",
				Status:   "in_progress",
				Deadline: nil,
				Title:    "No deadline task",
			}, nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	resp, err := uc.GetTask(context.Background(), "user-1", "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.IsOverdue {
		t.Error("expected task NOT to be overdue (no deadline)")
	}
}

func TestIsOverdue_DoneTask(t *testing.T) {
	yesterday := time.Now().AddDate(0, 0, -1).Truncate(24 * time.Hour)
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{
				ID:       "t1",
				Status:   "done",
				Deadline: &yesterday,
				Title:    "Done task with past deadline",
			}, nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	resp, err := uc.GetTask(context.Background(), "user-1", "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.IsOverdue {
		t.Error("expected done task NOT to be overdue even with past deadline")
	}
}

// --- Auto-start topic tests ---

func TestUpdateTaskStatus_ToInProgress_AutoStartTopic(t *testing.T) {
	topicID := "topic-1"
	var topicStarted bool

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "new", TopicID: &topicID}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
	}
	topicUpdater := &mockTopicUpdater{
		getTopicStatusFn: func(_ context.Context, _, _ string) (string, error) {
			return "not_started", nil
		},
		setTopicInProgressFn: func(_ context.Context, _, _ string) error {
			topicStarted = true
			return nil
		},
	}
	uc := task.NewUseCase(repo, topicUpdater)

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "in_progress"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !topicStarted {
		t.Error("expected topic to be auto-started when checklist task becomes in_progress")
	}
}

func TestUpdateTaskStatus_ToPaused_AutoStartTopic(t *testing.T) {
	topicID := "topic-1"
	var topicStarted bool

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "in_progress", TopicID: &topicID}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
	}
	topicUpdater := &mockTopicUpdater{
		getTopicStatusFn: func(_ context.Context, _, _ string) (string, error) {
			return "not_started", nil
		},
		setTopicInProgressFn: func(_ context.Context, _, _ string) error {
			topicStarted = true
			return nil
		},
	}
	uc := task.NewUseCase(repo, topicUpdater)

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "paused"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !topicStarted {
		t.Error("expected topic to be auto-started when checklist task becomes paused")
	}
}

func TestUpdateTaskStatus_ToDone_AutoStartAndCompleteTopic(t *testing.T) {
	topicID := "topic-1"
	var topicStarted, topicCompleted bool
	topicStatus := "not_started"

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "new", TopicID: &topicID}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
		countByTopicFn: func(_ context.Context, _, _ string) (int, int, error) {
			return 1, 1, nil
		},
	}
	topicUpdater := &mockTopicUpdater{
		getTopicStatusFn: func(_ context.Context, _, _ string) (string, error) {
			return topicStatus, nil
		},
		setTopicInProgressFn: func(_ context.Context, _, _ string) error {
			topicStarted = true
			topicStatus = "in_progress"
			return nil
		},
		setTopicCompletedFn: func(_ context.Context, _, _ string) error {
			topicCompleted = true
			return nil
		},
	}
	uc := task.NewUseCase(repo, topicUpdater)

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "done"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !topicStarted {
		t.Error("expected topic to be auto-started before auto-complete")
	}
	if !topicCompleted {
		t.Error("expected topic to be auto-completed after auto-start when all tasks done")
	}
}

func TestUpdateTaskStatus_ToInProgress_TopicAlreadyInProgress(t *testing.T) {
	topicID := "topic-1"
	var topicStarted bool

	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "new", TopicID: &topicID}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
	}
	topicUpdater := &mockTopicUpdater{
		getTopicStatusFn: func(_ context.Context, _, _ string) (string, error) {
			return "in_progress", nil
		},
		setTopicInProgressFn: func(_ context.Context, _, _ string) error {
			topicStarted = true
			return nil
		},
	}
	uc := task.NewUseCase(repo, topicUpdater)

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "in_progress"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if topicStarted {
		t.Error("topic should NOT be auto-started when already in_progress")
	}
}

func TestUpdateTaskStatus_ToInProgress_StandaloneTask_NoAutoStart(t *testing.T) {
	repo := &mockRepo{
		getByIDFn: func(_ context.Context, _, _ string) (task.Task, error) {
			return task.Task{ID: "t1", Status: "new", TopicID: nil}, nil
		},
		updateStatusFn: func(_ context.Context, _, _, _ string) error {
			return nil
		},
	}
	uc := task.NewUseCase(repo, &mockTopicUpdater{})

	err := uc.UpdateTaskStatus(context.Background(), "user-1", "t1", task.UpdateStatusRequest{Status: "in_progress"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
