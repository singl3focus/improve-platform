package today

import (
	"context"
	"testing"
	"time"
)

type useCaseRepoStub struct {
	getOrCreatePlanFn  func(ctx context.Context, userID string, date time.Time) (DailyPlan, error)
	setPlanItemsFn     func(ctx context.Context, planID string, taskIDs []string) error
	togglePlanItemFn   func(ctx context.Context, planID, taskID string, isCompleted bool) error
	saveReflectionFn   func(ctx context.Context, planID, reflection string) error
	getTodayTasksFn    func(ctx context.Context, userID string, date time.Time) ([]TodayTask, error)
	getCurrentMaterial func(ctx context.Context, userID string) (*TodayMaterial, error)
	getPlanItemCountFn func(ctx context.Context, planID string) (int, error)
	getFocusTaskIDsFn  func(ctx context.Context, userID string, date time.Time) ([]string, error)
	updateTaskStatusFn func(ctx context.Context, taskID, status string) error
}

func (s *useCaseRepoStub) GetOrCreatePlan(ctx context.Context, userID string, date time.Time) (DailyPlan, error) {
	return s.getOrCreatePlanFn(ctx, userID, date)
}

func (s *useCaseRepoStub) SetPlanItems(ctx context.Context, planID string, taskIDs []string) error {
	if s.setPlanItemsFn == nil {
		return nil
	}
	return s.setPlanItemsFn(ctx, planID, taskIDs)
}

func (s *useCaseRepoStub) TogglePlanItem(ctx context.Context, planID, taskID string, isCompleted bool) error {
	if s.togglePlanItemFn == nil {
		return nil
	}
	return s.togglePlanItemFn(ctx, planID, taskID, isCompleted)
}

func (s *useCaseRepoStub) SaveReflection(ctx context.Context, planID, reflection string) error {
	if s.saveReflectionFn == nil {
		return nil
	}
	return s.saveReflectionFn(ctx, planID, reflection)
}

func (s *useCaseRepoStub) GetTodayTasks(ctx context.Context, userID string, date time.Time) ([]TodayTask, error) {
	if s.getTodayTasksFn == nil {
		return nil, nil
	}
	return s.getTodayTasksFn(ctx, userID, date)
}

func (s *useCaseRepoStub) GetCurrentMaterial(ctx context.Context, userID string) (*TodayMaterial, error) {
	if s.getCurrentMaterial == nil {
		return nil, nil
	}
	return s.getCurrentMaterial(ctx, userID)
}

func (s *useCaseRepoStub) GetPlanItemCount(ctx context.Context, planID string) (int, error) {
	if s.getPlanItemCountFn == nil {
		return 0, nil
	}
	return s.getPlanItemCountFn(ctx, planID)
}

func (s *useCaseRepoStub) GetFocusTaskIDs(ctx context.Context, userID string, date time.Time) ([]string, error) {
	if s.getFocusTaskIDsFn == nil {
		return nil, nil
	}
	return s.getFocusTaskIDsFn(ctx, userID, date)
}

func (s *useCaseRepoStub) UpdateTaskStatus(ctx context.Context, taskID, status string) error {
	if s.updateTaskStatusFn == nil {
		return nil
	}
	return s.updateTaskStatusFn(ctx, taskID, status)
}

func TestCurrentDate_UsesRequestTimezone(t *testing.T) {
	t.Parallel()

	ctx := withTimezone(context.Background(), "Asia/Tokyo")
	date := currentDate(ctx)

	if date.Location().String() != "Asia/Tokyo" {
		t.Fatalf("expected Asia/Tokyo location, got %s", date.Location())
	}
	if date.Hour() != 0 || date.Minute() != 0 || date.Second() != 0 || date.Nanosecond() != 0 {
		t.Fatalf("expected start of day, got %s", date.Format(time.RFC3339Nano))
	}
}

func TestUseCaseGetToday_PassesTimezoneAwareDateToRepo(t *testing.T) {
	t.Parallel()

	var capturedDate time.Time
	repo := &useCaseRepoStub{
		getOrCreatePlanFn: func(_ context.Context, _ string, date time.Time) (DailyPlan, error) {
			capturedDate = date
			return DailyPlan{ID: "plan-1"}, nil
		},
		getPlanItemCountFn: func(_ context.Context, _ string) (int, error) {
			return 1, nil
		},
		getTodayTasksFn: func(_ context.Context, _ string, _ time.Time) ([]TodayTask, error) {
			return []TodayTask{}, nil
		},
	}

	uc := NewUseCase(repo)
	_, err := uc.GetToday(withTimezone(context.Background(), "Europe/Moscow"), "user-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if capturedDate.Location().String() != "Europe/Moscow" {
		t.Fatalf("expected Europe/Moscow location, got %s", capturedDate.Location())
	}
	if capturedDate.Hour() != 0 || capturedDate.Minute() != 0 || capturedDate.Second() != 0 || capturedDate.Nanosecond() != 0 {
		t.Fatalf("expected start of day, got %s", capturedDate.Format(time.RFC3339Nano))
	}
}
