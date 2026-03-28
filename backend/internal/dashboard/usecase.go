package dashboard

import (
	"context"

	"improve-platform/internal/history"
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

func (uc *UseCase) GetFocus(ctx context.Context, userID string) (FocusResponse, error) {
	tasks, err := uc.repo.GetFocusTasks(ctx, userID)
	if err != nil {
		return FocusResponse{}, err
	}

	resp := FocusResponse{
		SecondaryTasks: []FocusTask{},
	}

	if len(tasks) > 0 {
		resp.PrimaryTask = &tasks[0]
	}
	if len(tasks) > 1 {
		limit := len(tasks)
		if limit > 3 {
			limit = 3
		}
		resp.SecondaryTasks = tasks[1:limit]
	}

	continueTopic, _ := uc.repo.GetContinueTopic(ctx, userID)
	resp.ContinueTopic = continueTopic

	return resp, nil
}

func (uc *UseCase) GetWeeklyReviewData(ctx context.Context, userID string) (WeeklyReviewData, error) {
	return uc.repo.GetWeeklyReviewData(ctx, userID)
}

func (uc *UseCase) SaveWeeklyReview(ctx context.Context, userID string, req SaveWeeklyReviewRequest) error {
	if uc.recorder != nil {
		return uc.recorder.Record(ctx, history.Event{
			UserID:     userID,
			EntityType: "user",
			EntityID:   userID,
			EventType:  "business",
			EventName:  "weekly_review.completed",
			Payload: map[string]any{
				"period_start":           req.PeriodStart,
				"period_end":             req.PeriodEnd,
				"reflection_note":        req.ReflectionNote,
				"next_week_goal":         req.NextWeekGoal,
				"completed_tasks_count":  req.CompletedTasks,
				"completed_topics_count": req.CompletedTopics,
			},
		})
	}
	return nil
}
