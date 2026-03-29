package today

import (
	"context"
	"log/slog"
	"time"

	"improve-platform/internal/history"
	apperr "improve-platform/pkg/errors"
)

type UseCase struct {
	repo     *Repo
	recorder history.EventRecorder
}

func NewUseCase(repo *Repo) *UseCase {
	return &UseCase{repo: repo}
}

func (uc *UseCase) WithRecorder(r history.EventRecorder) *UseCase {
	uc.recorder = r
	return uc
}

func (uc *UseCase) record(ctx context.Context, ev history.Event) {
	if uc.recorder == nil {
		return
	}
	if err := uc.recorder.Record(ctx, ev); err != nil {
		slog.Error("failed to record history event", "event", ev.EventName, "error", err)
	}
}

func (uc *UseCase) GetToday(ctx context.Context, userID string) (TodayResponse, error) {
	const op apperr.Op = "today.UseCase.GetToday"
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	plan, err := uc.repo.GetOrCreatePlan(ctx, userID, today)
	if err != nil {
		return TodayResponse{}, apperr.E(op, err)
	}

	// Auto-populate if plan has no items
	count, err := uc.repo.GetPlanItemCount(ctx, plan.ID)
	if err != nil {
		return TodayResponse{}, apperr.E(op, err)
	}
	if count == 0 {
		focusIDs, err := uc.repo.GetFocusTaskIDs(ctx, userID)
		if err != nil {
			return TodayResponse{}, apperr.E(op, err)
		}
		if len(focusIDs) > 0 {
			if err := uc.repo.SetPlanItems(ctx, plan.ID, focusIDs); err != nil {
				return TodayResponse{}, apperr.E(op, err)
			}
		}
	}

	tasks, err := uc.repo.GetTodayTasks(ctx, userID, today)
	if err != nil {
		return TodayResponse{}, apperr.E(op, err)
	}
	if tasks == nil {
		tasks = []TodayTask{}
	}

	mat, err := uc.repo.GetCurrentMaterial(ctx, userID)
	if err != nil {
		return TodayResponse{}, apperr.E(op, err)
	}

	return TodayResponse{
		Date:            today.Format("2006-01-02"),
		Tasks:           tasks,
		CurrentMaterial: mat,
		Reflection:      plan.Reflection,
	}, nil
}

func (uc *UseCase) SetTasks(ctx context.Context, userID string, req SetTodayTasksRequest) error {
	const op apperr.Op = "today.UseCase.SetTasks"
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	plan, err := uc.repo.GetOrCreatePlan(ctx, userID, today)
	if err != nil {
		return apperr.E(op, err)
	}

	if err := uc.repo.SetPlanItems(ctx, plan.ID, req.TaskIDs); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID:     userID,
		EntityType: "daily_plan",
		EntityID:   plan.ID,
		EventType:  "technical",
		EventName:  "entity.updated",
		Payload:    map[string]any{"task_count": len(req.TaskIDs)},
	})

	return nil
}

func (uc *UseCase) ToggleTask(ctx context.Context, userID, taskID string, isCompleted bool) error {
	const op apperr.Op = "today.UseCase.ToggleTask"
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	plan, err := uc.repo.GetOrCreatePlan(ctx, userID, today)
	if err != nil {
		return apperr.E(op, err)
	}

	if err := uc.repo.TogglePlanItem(ctx, plan.ID, taskID, isCompleted); err != nil {
		return apperr.E(op, err)
	}

	// If completing, also mark the task as "done" in tasks table
	if isCompleted {
		if err := uc.repo.UpdateTaskStatus(ctx, taskID, "done"); err != nil {
			return apperr.E(op, err)
		}
		uc.record(ctx, history.Event{
			UserID:     userID,
			EntityType: "task",
			EntityID:   taskID,
			EventType:  "business",
			EventName:  "task.completed",
			Payload:    map[string]any{"source": "today_view"},
		})
	}

	return nil
}

func (uc *UseCase) SaveReflection(ctx context.Context, userID string, req SaveReflectionRequest) error {
	const op apperr.Op = "today.UseCase.SaveReflection"
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	plan, err := uc.repo.GetOrCreatePlan(ctx, userID, today)
	if err != nil {
		return apperr.E(op, err)
	}

	if err := uc.repo.SaveReflection(ctx, plan.ID, req.Reflection); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID:     userID,
		EntityType: "daily_plan",
		EntityID:   plan.ID,
		EventType:  "business",
		EventName:  "daily_reflection.saved",
		Payload:    map[string]any{"date": today.Format("2006-01-02")},
	})

	return nil
}
