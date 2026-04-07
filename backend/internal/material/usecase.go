package material

import (
	"context"
	"log/slog"

	"github.com/singl3focus/improve-platform/internal/history"
	apperr "github.com/singl3focus/improve-platform/pkg/errors"
)

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

func (uc *UseCase) CreateMaterial(ctx context.Context, userID string, req CreateRequest) (MaterialResponse, error) {
	const op apperr.Op = "UseCase.CreateMaterial"
	unit, ok := unitByType(req.Type)
	if !ok {
		return MaterialResponse{}, apperr.E(op, ErrInvalidMaterialType)
	}
	if req.TotalAmount < 0 || req.CompletedAmount < 0 || req.CompletedAmount > req.TotalAmount {
		return MaterialResponse{}, apperr.E(op, ErrInvalidAmount)
	}

	m := Material{
		UserID:          userID,
		TopicID:         req.TopicID,
		Title:           req.Title,
		Description:     req.Description,
		URL:             req.URL,
		Type:            req.Type,
		Unit:            unit,
		TotalAmount:     req.TotalAmount,
		CompletedAmount: req.CompletedAmount,
		Position:        req.Position,
	}

	created, err := uc.repo.Create(ctx, m)
	if err != nil {
		return MaterialResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "material", EntityID: created.ID,
		EventType: "technical", EventName: "entity.created",
		Payload: map[string]any{"title": created.Title, "topic_id": created.TopicID},
	})

	return buildResponse(created), nil
}

func (uc *UseCase) GetMaterial(ctx context.Context, userID, materialID string) (MaterialResponse, error) {
	const op apperr.Op = "UseCase.GetMaterial"
	m, err := uc.repo.GetByID(ctx, materialID, userID)
	if err != nil {
		return MaterialResponse{}, apperr.E(op, err)
	}
	return buildResponse(m), nil
}

func (uc *UseCase) ListByTopic(ctx context.Context, userID, topicID string) ([]MaterialResponse, error) {
	const op apperr.Op = "UseCase.ListByTopic"
	materials, err := uc.repo.ListByTopic(ctx, topicID, userID)
	if err != nil {
		return nil, apperr.E(op, err)
	}

	result := make([]MaterialResponse, 0, len(materials))
	for _, m := range materials {
		result = append(result, buildResponse(m))
	}
	return result, nil
}

func (uc *UseCase) UpdateMaterial(ctx context.Context, userID, materialID string, req UpdateRequest) error {
	const op apperr.Op = "UseCase.UpdateMaterial"
	unit, ok := unitByType(req.Type)
	if !ok {
		return apperr.E(op, ErrInvalidMaterialType)
	}
	if req.TotalAmount < 0 || req.CompletedAmount < 0 || req.CompletedAmount > req.TotalAmount {
		return apperr.E(op, ErrInvalidAmount)
	}

	if err := uc.repo.Update(
		ctx,
		materialID,
		userID,
		req.Title,
		req.Description,
		req.URL,
		req.Type,
		unit,
		req.TotalAmount,
		req.CompletedAmount,
		req.Position,
	); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "material", EntityID: materialID,
		EventType: "technical", EventName: "entity.updated",
		Payload: map[string]any{"title": req.Title, "type": req.Type, "completed_amount": req.CompletedAmount, "total_amount": req.TotalAmount},
	})

	return nil
}

func (uc *UseCase) DeleteMaterial(ctx context.Context, userID, materialID string) error {
	const op apperr.Op = "UseCase.DeleteMaterial"
	if err := uc.repo.Delete(ctx, materialID, userID); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID: userID, EntityType: "material", EntityID: materialID,
		EventType: "technical", EventName: "entity.deleted",
		Payload: map[string]any{},
	})

	return nil
}

func buildResponse(m Material) MaterialResponse {
	return MaterialResponse{
		ID:              m.ID,
		TopicID:         m.TopicID,
		Title:           m.Title,
		Description:     m.Description,
		URL:             m.URL,
		Type:            m.Type,
		Unit:            m.Unit,
		TotalAmount:     m.TotalAmount,
		CompletedAmount: m.CompletedAmount,
		Progress:        computeProgress(m.TotalAmount, m.CompletedAmount),
		Position:        m.Position,
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}
