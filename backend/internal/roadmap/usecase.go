package roadmap

import (
	"context"
	"log/slog"
	"time"

	"improve-platform/internal/history"
	"improve-platform/pkg/dateutil"
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

func (uc *UseCase) ListRoadmaps(ctx context.Context, userID string) ([]RoadmapListItem, error) {
	const op apperr.Op = "UseCase.ListRoadmaps"
	roadmaps, err := uc.repo.ListRoadmaps(ctx, userID)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	items := make([]RoadmapListItem, 0, len(roadmaps))
	for _, rm := range roadmaps {
		pct := 0
		if rm.TotalTopics > 0 {
			pct = rm.CompletedTopics * 100 / rm.TotalTopics
		}
		items = append(items, RoadmapListItem{
			ID:              rm.ID,
			Title:           rm.Title,
			Type:            rm.Type,
			TotalTopics:     rm.TotalTopics,
			CompletedTopics: rm.CompletedTopics,
			ProgressPercent: pct,
			CreatedAt:       rm.CreatedAt,
			UpdatedAt:       rm.UpdatedAt,
		})
	}
	return items, nil
}

func (uc *UseCase) CreateRoadmap(ctx context.Context, userID string, req CreateRoadmapRequest) (RoadmapResponse, error) {
	const op apperr.Op = "UseCase.CreateRoadmap"
	if !req.Type.IsValid() {
		return RoadmapResponse{}, apperr.E(op, ErrInvalidRoadmapType)
	}

	rm, err := uc.repo.CreateRoadmap(ctx, userID, req.Title, req.Type)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "roadmap", EntityID: rm.ID,
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{"title": rm.Title, "type": rm.Type},
	})

	return RoadmapResponse{
		ID:           rm.ID,
		Title:        rm.Title,
		Type:         rm.Type,
		CreatedAt:    rm.CreatedAt,
		UpdatedAt:    rm.UpdatedAt,
		Topics:       []TopicResponse{},
		Dependencies: []TopicDependencyResponse{},
	}, nil
}

func (uc *UseCase) GetFullRoadmap(ctx context.Context, userID, roadmapID string) (RoadmapResponse, error) {
	const op apperr.Op = "UseCase.GetFullRoadmap"
	rm, err := uc.repo.GetRoadmapByID(ctx, roadmapID, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	topics, err := uc.repo.GetTopicsByRoadmapID(ctx, roadmapID, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	deps, err := uc.repo.GetDependenciesByRoadmapID(ctx, roadmapID, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	metricsByTopicID, err := uc.repo.GetTopicMetricsByRoadmapID(ctx, roadmapID, userID)
	if err != nil {
		return RoadmapResponse{}, apperr.E(op, err)
	}

	return uc.assembleRoadmap(rm, topics, deps, metricsByTopicID), nil
}

func (uc *UseCase) UpdateRoadmap(ctx context.Context, userID, roadmapID string, req UpdateRoadmapRequest) error {
	const op apperr.Op = "UseCase.UpdateRoadmap"
	if err := uc.repo.UpdateRoadmapTitle(ctx, roadmapID, userID, req.Title); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "roadmap", EntityID: roadmapID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"title": req.Title},
	})

	return nil
}

func (uc *UseCase) DeleteRoadmap(ctx context.Context, userID, roadmapID string) error {
	const op apperr.Op = "UseCase.DeleteRoadmap"
	if err := uc.repo.DeleteRoadmap(ctx, roadmapID, userID); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "roadmap", EntityID: roadmapID,
		EventType: "technical", EventName: "entity.deleted",
		Payload: map[string]any{},
	})

	return nil
}

// --- Topics ---

func (uc *UseCase) CreateTopic(ctx context.Context, userID, roadmapID string, req CreateTopicRequest) (TopicResponse, error) {
	const op apperr.Op = "UseCase.CreateTopic"
	var (
		t   Topic
		err error
	)

	if req.IsDirectional() {
		if req.RelativeToTopicID == "" || !req.Direction.IsValid() {
			return TopicResponse{}, apperr.E(op, ErrInvalidDirection)
		}

		t, err = uc.repo.CreateTopicDirectional(
			ctx,
			userID,
			roadmapID,
			req.RelativeToTopicID,
			req.Title,
			req.Description,
			req.Direction,
		)
	} else {
		t, err = uc.repo.CreateTopic(ctx, userID, roadmapID, req.Title, req.Description, req.Position)
	}
	if err != nil {
		return TopicResponse{}, apperr.E(op, err)
	}

	// Auto-create dependency: new topic depends on the anchor topic.
	// This ensures edges (arrows) appear in the roadmap graph.
	var depIDs []string
	if req.IsDirectional() && req.RelativeToTopicID != "" {
		if addErr := uc.repo.AddDependency(ctx, t.ID, req.RelativeToTopicID, userID); addErr != nil {
			return TopicResponse{}, apperr.E(op, addErr)
		}
		depIDs = []string{req.RelativeToTopicID}
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: t.ID,
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{"title": t.Title},
	})

	return buildTopicResponse(t, depIDs, TopicMetrics{}), nil
}

func (uc *UseCase) GetTopic(ctx context.Context, userID, topicID string) (TopicResponse, error) {
	const op apperr.Op = "UseCase.GetTopic"
	t, err := uc.repo.GetTopicByID(ctx, topicID, userID)
	if err != nil {
		return TopicResponse{}, apperr.E(op, err)
	}

	deps, err := uc.repo.GetDependenciesByRoadmapID(ctx, t.RoadmapID, userID)
	if err != nil {
		return TopicResponse{}, apperr.E(op, err)
	}

	depMap := buildDepMap(deps)

	return buildTopicResponse(t, depMap[t.ID], TopicMetrics{}), nil
}

func (uc *UseCase) UpdateTopic(ctx context.Context, userID, topicID string, req UpdateTopicRequest) error {
	const op apperr.Op = "UseCase.UpdateTopic"
	_, err := uc.repo.GetTopicByID(ctx, topicID, userID)
	if err != nil {
		return apperr.E(op, err)
	}

	startDate, err := dateutil.Parse(req.StartDate)
	if err != nil {
		return apperr.E(op, apperr.Fmt("start_date: %w", err))
	}
	targetDate, err := dateutil.Parse(req.TargetDate)
	if err != nil {
		return apperr.E(op, apperr.Fmt("target_date: %w", err))
	}

	if err := uc.repo.UpdateTopic(ctx, topicID, userID, req.Title, req.Description, startDate, targetDate, req.Position); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: topicID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"title": req.Title},
	})

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

func (uc *UseCase) SetTopicConfidence(ctx context.Context, userID, topicID string, req SetConfidenceRequest) error {
	const op apperr.Op = "UseCase.SetTopicConfidence"
	if req.Confidence < 1 || req.Confidence > 5 {
		return apperr.E(op, ErrInvalidConfidence)
	}
	if err := uc.repo.SetTopicConfidence(ctx, topicID, userID, req.Confidence); err != nil {
		return apperr.E(op, err)
	}
	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "topic", EntityID: topicID,
		EventType: "business", EventName: "topic.confidence_set",
		Payload: map[string]any{"confidence": req.Confidence},
	})
	return nil
}

// --- Dependencies ---

func (uc *UseCase) AddDependency(ctx context.Context, userID, topicID string, req AddDependencyRequest) error {
	const op apperr.Op = "UseCase.AddDependency"
	if topicID == req.DependsOnTopicID {
		return apperr.E(op, ErrSelfDependency)
	}

	topic, err := uc.repo.GetTopicByID(ctx, topicID, userID)
	if err != nil {
		return apperr.E(op, err)
	}
	if _, err := uc.repo.GetTopicByID(ctx, req.DependsOnTopicID, userID); err != nil {
		return apperr.E(op, err)
	}

	deps, err := uc.repo.GetDependenciesByRoadmapID(ctx, topic.RoadmapID, userID)
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

func (uc *UseCase) assembleRoadmap(rm Roadmap, topics []Topic, deps []TopicDep, metricsByTopicID map[string]TopicMetrics) RoadmapResponse {
	depMap := buildDepMap(deps)

	topicResponses := make([]TopicResponse, 0, len(topics))
	for _, t := range topics {
		topicResponses = append(topicResponses, buildTopicResponse(t, depMap[t.ID], metricsByTopicID[t.ID]))
	}

	return RoadmapResponse{
		ID:           rm.ID,
		Title:        rm.Title,
		Type:         rm.Type,
		CreatedAt:    rm.CreatedAt,
		UpdatedAt:    rm.UpdatedAt,
		Topics:       topicResponses,
		Dependencies: buildDependencyResponses(deps),
	}
}

// buildTopicResponse builds the API response for a single topic.
func buildTopicResponse(t Topic, depIDs []string, metrics TopicMetrics) TopicResponse {
	if depIDs == nil {
		depIDs = []string{}
	}
	return TopicResponse{
		ID:              t.ID,
		RoadmapID:       t.RoadmapID,
		Title:           t.Title,
		Description:     t.Description,
		Status:          t.Status,
		Confidence:      t.Confidence,
		StartDate:       dateutil.Format(t.StartDate),
		TargetDate:      dateutil.Format(t.TargetDate),
		CompletedDate:   dateutil.Format(t.CompletedDate),
		Position:        t.Position,
		TasksCount:      metrics.TasksCount,
		MaterialsCount:  metrics.MaterialsCount,
		ProgressPercent: metrics.ProgressPercent,
		Dependencies:    depIDs,
		CreatedAt:       t.CreatedAt,
		UpdatedAt:       t.UpdatedAt,
	}
}

func buildDependencyResponses(deps []TopicDep) []TopicDependencyResponse {
	if deps == nil {
		return []TopicDependencyResponse{}
	}
	resp := make([]TopicDependencyResponse, 0, len(deps))
	for _, dep := range deps {
		resp = append(resp, TopicDependencyResponse{
			TopicID:          dep.TopicID,
			DependsOnTopicID: dep.DependsOnTopicID,
		})
	}
	return resp
}
