package note

import (
	"context"
	"log/slog"

	"improve-platform/internal/history"
	apperr "improve-platform/pkg/errors"
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

func toResponse(n Note) NoteResponse {
	return NoteResponse{
		ID:        n.ID,
		TopicID:   n.TopicID,
		Title:     n.Title,
		Content:   n.Content,
		Position:  n.Position,
		CreatedAt: n.CreatedAt,
		UpdatedAt: n.UpdatedAt,
	}
}

func (uc *UseCase) Create(ctx context.Context, userID string, req CreateNoteRequest) (NoteResponse, error) {
	const op apperr.Op = "note.UseCase.Create"

	n := Note{
		UserID:  userID,
		TopicID: req.TopicID,
		Title:   req.Title,
		Content: req.Content,
	}

	created, err := uc.repo.Create(ctx, n)
	if err != nil {
		return NoteResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID:     userID,
		EntityType: "note",
		EntityID:   created.ID,
		EventType:  "technical",
		EventName:  "entity.created",
		Payload:    map[string]any{"title": created.Title, "topic_id": created.TopicID},
	})

	return toResponse(created), nil
}

func (uc *UseCase) GetByID(ctx context.Context, userID, noteID string) (NoteResponse, error) {
	const op apperr.Op = "note.UseCase.GetByID"

	n, err := uc.repo.GetByID(ctx, userID, noteID)
	if err != nil {
		return NoteResponse{}, apperr.E(op, err)
	}
	return toResponse(n), nil
}

func (uc *UseCase) ListByTopic(ctx context.Context, userID, topicID string) ([]NoteResponse, error) {
	const op apperr.Op = "note.UseCase.ListByTopic"

	notes, err := uc.repo.ListByTopic(ctx, userID, topicID)
	if err != nil {
		return nil, apperr.E(op, err)
	}

	result := make([]NoteResponse, 0, len(notes))
	for _, n := range notes {
		result = append(result, toResponse(n))
	}
	return result, nil
}

func (uc *UseCase) Update(ctx context.Context, userID, noteID string, req UpdateNoteRequest) (NoteResponse, error) {
	const op apperr.Op = "note.UseCase.Update"

	updated, err := uc.repo.Update(ctx, userID, noteID, req.Title, req.Content)
	if err != nil {
		return NoteResponse{}, apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID:     userID,
		EntityType: "note",
		EntityID:   updated.ID,
		EventType:  "technical",
		EventName:  "entity.updated",
		Payload:    map[string]any{"title": updated.Title},
	})

	return toResponse(updated), nil
}

func (uc *UseCase) Delete(ctx context.Context, userID, noteID string) error {
	const op apperr.Op = "note.UseCase.Delete"

	if err := uc.repo.Delete(ctx, userID, noteID); err != nil {
		return apperr.E(op, err)
	}

	uc.record(ctx, history.Event{
		UserID:     userID,
		EntityType: "note",
		EntityID:   noteID,
		EventType:  "technical",
		EventName:  "entity.deleted",
		Payload:    map[string]any{},
	})

	return nil
}
