package task

import (
	"context"
	"log/slog"
	"time"

	"github.com/singl3focus/improve-platform/internal/history"
	"github.com/singl3focus/improve-platform/pkg/dateutil"
	apperr "github.com/singl3focus/improve-platform/pkg/errors"
)

var validTransitions = map[string][]string{
	"new":         {"in_progress", "done"},
	"in_progress": {"paused", "done"},
	"paused":      {"in_progress", "new", "done"},
	"done":        {"in_progress"},
}

type UseCase struct {
	repo         Repository
	topicUpdater TopicStatusUpdater
	recorder     history.EventRecorder
}

func NewUseCase(repo Repository, topicUpdater TopicStatusUpdater) *UseCase {
	return &UseCase{repo: repo, topicUpdater: topicUpdater}
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

// --- CRUD ---

func (uc *UseCase) CreateTask(ctx context.Context, userID string, req CreateRequest) (TaskResponse, error) {
	const op apperr.Op = "UseCase.CreateTask"
	deadline, err := dateutil.Parse(req.Deadline)
	if err != nil {
		return TaskResponse{}, apperr.E(op, apperr.Fmt("deadline: %w", err))
	}

	t := Task{
		UserID:      userID,
		TopicID:     req.TopicID,
		Title:       req.Title,
		Description: req.Description,
		Deadline:    deadline,
		Position:    req.Position,
	}

	created, err := uc.repo.Create(ctx, t)
	if err != nil {
		return TaskResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "task", EntityID: created.ID,
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{"title": created.Title},
	})

	return buildTaskResponse(created), nil
}

func (uc *UseCase) GetTask(ctx context.Context, userID, taskID string) (TaskResponse, error) {
	const op apperr.Op = "UseCase.GetTask"
	t, err := uc.repo.GetByID(ctx, taskID, userID)
	if err != nil {
		return TaskResponse{}, apperr.E(op, err)
	}
	return buildTaskResponse(t), nil
}

func (uc *UseCase) ListTasks(ctx context.Context, userID string, topicID *string) ([]TaskResponse, error) {
	const op apperr.Op = "UseCase.ListTasks"
	tasks, err := uc.repo.ListByUser(ctx, userID, topicID)
	if err != nil {
		return nil, apperr.E(op, err)
	}

	result := make([]TaskResponse, 0, len(tasks))
	for _, t := range tasks {
		result = append(result, buildTaskResponse(t))
	}
	return result, nil
}

func (uc *UseCase) UpdateTask(ctx context.Context, userID, taskID string, req UpdateRequest) error {
	const op apperr.Op = "UseCase.UpdateTask"
	old, err := uc.repo.GetByID(ctx, taskID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	deadline, err := dateutil.Parse(req.Deadline)
	if err != nil {
		return apperr.E(op, apperr.Fmt("deadline: %w", err))
	}

	if err := uc.repo.Update(
		ctx,
		taskID,
		userID,
		req.Title,
		req.Description,
		deadline,
		req.Position,
		req.TopicID,
		req.topicIDProvided,
	); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "task", EntityID: taskID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"title": req.Title},
	})

	if !dateutil.Equal(old.Deadline, deadline) {
		uc.record(ctx, history.Event{
			UserID: userID, EntityType: "task", EntityID: taskID,
			EventType: "business", EventName: "task.deadline_changed",
			Payload: map[string]any{
				"old_deadline": dateutil.ToAny(old.Deadline),
				"new_deadline": dateutil.ToAny(deadline),
			},
		})
	}

	return nil
}

func (uc *UseCase) UpdateTaskStatus(ctx context.Context, userID, taskID string, req UpdateStatusRequest) error {
	const op apperr.Op = "UseCase.UpdateTaskStatus"
	t, err := uc.repo.GetByID(ctx, taskID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	if !isValidTransition(t.Status, req.Status) {
		return apperr.E(op, ErrInvalidStatus)
	}

	if err := uc.repo.UpdateStatus(ctx, taskID, userID, req.Status); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "task", EntityID: taskID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"field": "status", "old_value": t.Status, "new_value": req.Status},
	})

	if req.Status == "done" && t.TopicID != nil {
		uc.record(ctx, history.Event{
			UserID: userID, EntityType: "task", EntityID: taskID,
			EventType: "business", EventName: "task.completed",
			Payload: map[string]any{"task_title": t.Title, "topic_id": *t.TopicID},
		})
	}

	if t.TopicID != nil && (req.Status == "done" || t.Status == "done") {
		total, done, countErr := uc.repo.CountByTopic(ctx, *t.TopicID, userID)
		if countErr == nil && total > 0 {
			percent := done * 100 / total
			uc.record(ctx, history.Event{
				UserID: userID, EntityType: "topic", EntityID: *t.TopicID,
				EventType: "business", EventName: "topic.progress_changed",
				Payload: map[string]any{"total": total, "done": done, "percent": percent},
			})
		}
	}

	if t.TopicID != nil && (req.Status == "in_progress" || req.Status == "paused" || req.Status == "done") {
		if err := uc.tryAutoStartTopic(ctx, *t.TopicID, userID); err != nil {
			return apperr.E(op, err)
		}
	}

	if req.Status == "done" && t.TopicID != nil {
		if err := uc.tryAutoCompleteTopic(ctx, *t.TopicID, userID); err != nil {
			return apperr.E(op, err)
		}
	}

	return nil
}

func (uc *UseCase) DeleteTask(ctx context.Context, userID, taskID string) error {
	const op apperr.Op = "UseCase.DeleteTask"
	if err := uc.repo.Delete(ctx, taskID, userID); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "task", EntityID: taskID,
		EventType: "technical", EventName: "entity.deleted",
		Payload: map[string]any{},
	})

	return nil
}

// --- Topic tasks with progress ---

func (uc *UseCase) GetTopicTasks(ctx context.Context, userID, topicID string) (TopicTasksResponse, error) {
	const op apperr.Op = "UseCase.GetTopicTasks"
	tid := topicID
	tasks, err := uc.repo.ListByUser(ctx, userID, &tid)
	if err != nil {
		return TopicTasksResponse{}, apperr.E(op, err)
	}

	total, done, err := uc.repo.CountByTopic(ctx, topicID, userID)
	if err != nil {
		return TopicTasksResponse{}, apperr.E(op, err)
	}

	percent := 0
	if total > 0 {
		percent = done * 100 / total
	}

	taskResponses := make([]TaskResponse, 0, len(tasks))
	for _, t := range tasks {
		taskResponses = append(taskResponses, buildTaskResponse(t))
	}

	return TopicTasksResponse{
		TopicID: topicID,
		Total:   total,
		Done:    done,
		Percent: percent,
		Tasks:   taskResponses,
	}, nil
}

// --- Auto-sync logic ---

func (uc *UseCase) tryAutoStartTopic(ctx context.Context, topicID, userID string) error {
	const op apperr.Op = "UseCase.tryAutoStartTopic"
	status, err := uc.topicUpdater.GetTopicStatus(ctx, topicID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	if status != "not_started" {
		return nil
	}

	if err := uc.topicUpdater.SetTopicInProgress(ctx, topicID, userID); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: topicID,
		EventType: "business", EventName: "topic.status_changed",
		Payload: map[string]any{
			"old_status": "not_started",
			"new_status": "in_progress",
			"trigger":    "auto_start",
		},
	})

	return nil
}

func (uc *UseCase) tryAutoCompleteTopic(ctx context.Context, topicID, userID string) error {
	const op apperr.Op = "UseCase.tryAutoCompleteTopic"
	total, done, err := uc.repo.CountByTopic(ctx, topicID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	if total == 0 || done < total {
		return nil
	}

	status, err := uc.topicUpdater.GetTopicStatus(ctx, topicID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	if status == "in_progress" {
		if err := uc.topicUpdater.SetTopicCompleted(ctx, topicID, userID); err != nil {
			return apperr.E(op, err)
		}
		uc.record(ctx, history.Event{
			UserID: userID, EntityType: "topic", EntityID: topicID,
			EventType: "business", EventName: "topic.status_changed",
			Payload: map[string]any{
				"old_status": "in_progress",
				"new_status": "completed",
				"trigger":    "auto_complete",
			},
		})
	}

	return nil
}

// --- Helpers ---

func isValidTransition(from, to string) bool {
	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func buildTaskResponse(t Task) TaskResponse {
	return TaskResponse{
		ID:          t.ID,
		TopicID:     t.TopicID,
		Title:       t.Title,
		Description: t.Description,
		Status:      t.Status,
		Deadline:    dateutil.Format(t.Deadline),
		Position:    t.Position,
		IsOverdue:   computeOverdue(t.Status, t.Deadline),
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}
}

func computeOverdue(status string, deadline *time.Time) bool {
	if deadline == nil || status == "done" {
		return false
	}
	return time.Now().Truncate(24 * time.Hour).After(*deadline)
}
