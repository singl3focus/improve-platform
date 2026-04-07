package history

import (
	"context"

	apperr "github.com/singl3focus/improve-platform/pkg/errors"
)

type UseCase struct {
	repo Repository
}

func NewUseCase(repo Repository) *UseCase {
	return &UseCase{repo: repo}
}

func (uc *UseCase) Record(ctx context.Context, event Event) error {
	const op apperr.Op = "UseCase.Record"
	return apperr.E(op, uc.repo.Insert(ctx, event))
}

func (uc *UseCase) GetEntityHistory(ctx context.Context, userID, entityType, entityID string) ([]EventResponse, error) {
	const op apperr.Op = "UseCase.GetEntityHistory"
	records, err := uc.repo.ListByEntity(ctx, userID, entityType, entityID)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	return buildResponses(records), nil
}

func (uc *UseCase) GetUserHistory(ctx context.Context, userID string, entityType *string, limit, offset int) ([]EventResponse, error) {
	const op apperr.Op = "UseCase.GetUserHistory"
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	records, err := uc.repo.ListByUser(ctx, userID, entityType, limit, offset)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	return buildResponses(records), nil
}

func buildResponses(records []EventRecord) []EventResponse {
	responses := make([]EventResponse, 0, len(records))
	for _, r := range records {
		responses = append(responses, EventResponse{
			ID:         r.ID,
			EntityType: r.EntityType,
			EntityID:   r.EntityID,
			EventType:  r.EventType,
			EventName:  r.EventName,
			Payload:    r.Payload,
			CreatedAt:  r.CreatedAt,
		})
	}
	return responses
}
