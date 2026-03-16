package roadmap

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"improve-platform/internal/history"
	apperr "improve-platform/pkg/errors"
)

var validTransitions = map[string][]string{
	"not_started": {"in_progress"},
	"in_progress": {"paused", "completed"},
	"paused":      {"in_progress", "not_started"},
	"completed":   {"in_progress"},
}

type UseCase struct {
	repo     Repository
	recorder history.EventRecorder
}

func NewUseCase(repo Repository) *UseCase {
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

// --- Roadmap ---

func (uc *UseCase) CreateRoadmap(ctx context.Context, userID string, req CreateRoadmapRequest) (RoadmapResponse, error) {
	const op apperr.Op = "UseCase.CreateRoadmap"
	rm, err := uc.repo.CreateRoadmap(ctx, userID, req.Title)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "roadmap", EntityID: rm.ID,
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{"title": rm.Title},
	})

	return RoadmapResponse{
		ID:        rm.ID,
		Title:     rm.Title,
		CreatedAt: rm.CreatedAt,
		UpdatedAt: rm.UpdatedAt,
		Stages:    []StageResponse{},
	}, nil
}

func (uc *UseCase) GetFullRoadmap(ctx context.Context, userID string) (RoadmapResponse, error) {
	const op apperr.Op = "UseCase.GetFullRoadmap"
	rm, err := uc.repo.GetRoadmapByUserID(ctx, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	stages, err := uc.repo.GetStagesByUserID(ctx, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	topics, err := uc.repo.GetTopicsByUserID(ctx, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	deps, err := uc.repo.GetDependenciesByUserID(ctx, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	return uc.assembleRoadmap(rm, stages, topics, deps), nil
}

func (uc *UseCase) UpdateRoadmap(ctx context.Context, userID string, req UpdateRoadmapRequest) error {
	const op apperr.Op = "UseCase.UpdateRoadmap"
	rm, err := uc.repo.GetRoadmapByUserID(ctx, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	if err := uc.repo.UpdateRoadmapTitle(ctx, userID, req.Title); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "roadmap", EntityID: rm.ID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"title": req.Title},
	})

	return nil
}

// --- Stages ---

func (uc *UseCase) CreateStage(ctx context.Context, userID string, req CreateStageRequest) (StageResponse, error) {
	const op apperr.Op = "UseCase.CreateStage"
	rm, err := uc.repo.GetRoadmapByUserID(ctx, userID)
	if err != nil {
		return StageResponse{}, apperr.E(op, err)
	}

	s, err := uc.repo.CreateStage(ctx, rm.ID, userID, req.Title, req.Position)
	if err != nil {
		return StageResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "stage", EntityID: s.ID,
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{"title": s.Title},
	})

	return StageResponse{
		ID:        s.ID,
		Title:     s.Title,
		Position:  s.Position,
		CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt,
		Topics:    []TopicResponse{},
	}, nil
}

func (uc *UseCase) UpdateStage(ctx context.Context, userID, stageID string, req UpdateStageRequest) error {
	const op apperr.Op = "UseCase.UpdateStage"
	if err := uc.repo.UpdateStage(ctx, stageID, userID, req.Title, req.Position); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "stage", EntityID: stageID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"title": req.Title},
	})

	return nil
}

func (uc *UseCase) DeleteStage(ctx context.Context, userID, stageID string) error {
	const op apperr.Op = "UseCase.DeleteStage"
	if err := uc.repo.DeleteStage(ctx, stageID, userID); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "stage", EntityID: stageID,
		EventType: "technical", EventName: "entity.deleted",
		Payload: map[string]any{},
	})

	return nil
}

// --- Topics ---

func (uc *UseCase) CreateTopic(ctx context.Context, userID string, req CreateTopicRequest) (TopicResponse, error) {
	const op apperr.Op = "UseCase.CreateTopic"
	t, err := uc.repo.CreateTopic(ctx, userID, req.StageID, req.Title, req.Description, req.Position)
	if err != nil {
		return TopicResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: t.ID,
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{"title": t.Title, "stage_id": t.StageID},
	})

	return buildTopicResponse(t, nil, false, nil), nil
}

func (uc *UseCase) GetTopic(ctx context.Context, userID, topicID string) (TopicResponse, error) {
	const op apperr.Op = "UseCase.GetTopic"
	t, err := uc.repo.GetTopicByID(ctx, topicID, userID)
	if err != nil {
		return TopicResponse{}, apperr.E(op, err)
	}

	topics, err := uc.repo.GetTopicsByUserID(ctx, userID)
	if err != nil {
		return TopicResponse{}, apperr.E(op, err)
	}

	deps, err := uc.repo.GetDependenciesByUserID(ctx, userID)
	if err != nil {
		return TopicResponse{}, apperr.E(op, err)
	}

	topicMap := buildTopicMap(topics)
	depMap := buildDepMap(deps)
	blocked, reasons := computeBlockage(t.ID, topicMap, depMap)

	return buildTopicResponse(t, depMap[t.ID], blocked, reasons), nil
}

func (uc *UseCase) UpdateTopic(ctx context.Context, userID, topicID string, req UpdateTopicRequest) error {
	const op apperr.Op = "UseCase.UpdateTopic"
	old, err := uc.repo.GetTopicByID(ctx, topicID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	startDate, err := parseDate(req.StartDate)
	if err != nil {
		return apperr.E(op, apperr.Fmt("start_date: %w", err))
	}
	targetDate, err := parseDate(req.TargetDate)
	if err != nil {
		return apperr.E(op, apperr.Fmt("target_date: %w", err))
	}

	if err := uc.repo.UpdateTopic(ctx, topicID, userID, req.StageID, req.Title, req.Description, startDate, targetDate, req.Position); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: topicID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"title": req.Title},
	})

	if old.StageID != req.StageID {
		uc.record(ctx, history.Event{
			UserID: userID, EntityType: "topic", EntityID: topicID,
			EventType: "business", EventName: "topic.stage_changed",
			Payload: map[string]any{"old_stage_id": old.StageID, "new_stage_id": req.StageID},
		})
	}

	return nil
}

func (uc *UseCase) UpdateTopicStatus(ctx context.Context, userID, topicID string, req UpdateStatusRequest) error {
	const op apperr.Op = "UseCase.UpdateTopicStatus"
	topic, err := uc.repo.GetTopicByID(ctx, topicID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	if !isValidTransition(topic.Status, req.Status) {
		return apperr.E(op, ErrInvalidStatus)
	}

	if req.Status == "in_progress" {
		topics, err := uc.repo.GetTopicsByUserID(ctx, userID)
		if err != nil {
			return apperr.E(op, err)
		}
		deps, err := uc.repo.GetDependenciesByUserID(ctx, userID)
		if err != nil {
			return apperr.E(op, err)
		}
		topicMap := buildTopicMap(topics)
		depMap := buildDepMap(deps)
		blocked, _ := computeBlockage(topicID, topicMap, depMap)
		if blocked {
			return apperr.E(op, ErrTopicBlocked)
		}
	}

	var startDate *time.Time
	var completedDate *time.Time

	if req.Status == "in_progress" && topic.StartDate == nil {
		now := time.Now().Truncate(24 * time.Hour)
		startDate = &now
	}

	if req.Status == "completed" {
		now := time.Now().Truncate(24 * time.Hour)
		completedDate = &now
	}

	if err := uc.repo.UpdateTopicStatus(ctx, topicID, userID, req.Status, startDate, completedDate); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: topicID,
		EventType: "business", EventName: "topic.status_changed",
		Payload: map[string]any{"old_status": topic.Status, "new_status": req.Status},
	})

	return nil
}

func (uc *UseCase) DeleteTopic(ctx context.Context, userID, topicID string) error {
	const op apperr.Op = "UseCase.DeleteTopic"
	if err := uc.repo.DeleteTopic(ctx, topicID, userID); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: topicID,
		EventType: "technical", EventName: "entity.deleted",
		Payload: map[string]any{},
	})

	return nil
}

// --- Dependencies ---

func (uc *UseCase) AddDependency(ctx context.Context, userID, topicID string, req AddDependencyRequest) error {
	const op apperr.Op = "UseCase.AddDependency"
	if topicID == req.DependsOnTopicID {
		return apperr.E(op, ErrSelfDependency)
	}

	if _, err := uc.repo.GetTopicByID(ctx, topicID, userID); err != nil {
		return apperr.E(op, err)
	}
	if _, err := uc.repo.GetTopicByID(ctx, req.DependsOnTopicID, userID); err != nil {
		return apperr.E(op, err)
	}

	deps, err := uc.repo.GetDependenciesByUserID(ctx, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	depMap := buildDepMap(deps)
	if wouldCreateCycle(depMap, topicID, req.DependsOnTopicID) {
		return apperr.E(op, ErrCycleDetected)
	}

	return apperr.E(op, uc.repo.AddDependency(ctx, topicID, req.DependsOnTopicID, userID))
}

func (uc *UseCase) RemoveDependency(ctx context.Context, userID, topicID, depTopicID string) error {
	const op apperr.Op = "UseCase.RemoveDependency"
	return apperr.E(op, uc.repo.RemoveDependency(ctx, topicID, depTopicID, userID))
}

// --- DAG helpers ---

func buildDepMap(deps []TopicDep) map[string][]string {
	m := make(map[string][]string)
	for _, d := range deps {
		m[d.TopicID] = append(m[d.TopicID], d.DependsOnTopicID)
	}
	return m
}

func buildTopicMap(topics []Topic) map[string]Topic {
	m := make(map[string]Topic, len(topics))
	for _, t := range topics {
		m[t.ID] = t
	}
	return m
}

func wouldCreateCycle(depMap map[string][]string, topicID, dependsOnID string) bool {
	visited := make(map[string]bool)
	return canReach(depMap, dependsOnID, topicID, visited)
}

func canReach(depMap map[string][]string, current, target string, visited map[string]bool) bool {
	if current == target {
		return true
	}
	if visited[current] {
		return false
	}
	visited[current] = true
	for _, next := range depMap[current] {
		if canReach(depMap, next, target, visited) {
			return true
		}
	}
	return false
}

func computeBlockage(topicID string, topicMap map[string]Topic, depMap map[string][]string) (bool, []string) {
	prereqs := depMap[topicID]
	var reasons []string
	for _, depID := range prereqs {
		dep, ok := topicMap[depID]
		if !ok {
			continue
		}
		if dep.Status != "completed" {
			reasons = append(reasons, fmt.Sprintf("prerequisite topic '%s' is not completed", dep.Title))
		}
	}
	return len(reasons) > 0, reasons
}

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

// --- Response builders ---

func (uc *UseCase) assembleRoadmap(rm Roadmap, stages []Stage, topics []Topic, deps []TopicDep) RoadmapResponse {
	topicMap := buildTopicMap(topics)
	depMap := buildDepMap(deps)

	topicsByStage := make(map[string][]Topic)
	for _, t := range topics {
		topicsByStage[t.StageID] = append(topicsByStage[t.StageID], t)
	}

	stageResponses := make([]StageResponse, 0, len(stages))
	for _, s := range stages {
		stageTopics := topicsByStage[s.ID]
		topicResponses := make([]TopicResponse, 0, len(stageTopics))
		for _, t := range stageTopics {
			blocked, reasons := computeBlockage(t.ID, topicMap, depMap)
			topicResponses = append(topicResponses, buildTopicResponse(t, depMap[t.ID], blocked, reasons))
		}
		stageResponses = append(stageResponses, StageResponse{
			ID:        s.ID,
			Title:     s.Title,
			Position:  s.Position,
			CreatedAt: s.CreatedAt,
			UpdatedAt: s.UpdatedAt,
			Topics:    topicResponses,
		})
	}

	return RoadmapResponse{
		ID:        rm.ID,
		Title:     rm.Title,
		CreatedAt: rm.CreatedAt,
		UpdatedAt: rm.UpdatedAt,
		Stages:    stageResponses,
	}
}

func buildTopicResponse(t Topic, depIDs []string, blocked bool, reasons []string) TopicResponse {
	if depIDs == nil {
		depIDs = []string{}
	}
	if reasons == nil {
		reasons = []string{}
	}
	return TopicResponse{
		ID:            t.ID,
		StageID:       t.StageID,
		Title:         t.Title,
		Description:   t.Description,
		Status:        t.Status,
		StartDate:     formatDate(t.StartDate),
		TargetDate:    formatDate(t.TargetDate),
		CompletedDate: formatDate(t.CompletedDate),
		Position:      t.Position,
		IsBlocked:     blocked,
		BlockReasons:  reasons,
		Dependencies:  depIDs,
		CreatedAt:     t.CreatedAt,
		UpdatedAt:     t.UpdatedAt,
	}
}

func formatDate(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02")
	return &s
}

func parseDate(s *string) (*time.Time, error) {
	if s == nil {
		return nil, nil
	}
	if *s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, fmt.Errorf("invalid date format, expected YYYY-MM-DD: %w", err)
	}
	return &t, nil
}
