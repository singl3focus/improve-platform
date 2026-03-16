package history

import (
	"context"
	"time"
)

type Event struct {
	UserID     string
	EntityType string
	EntityID   string
	EventType  string // "technical" or "business"
	EventName  string
	Payload    map[string]any
}

type EventRecord struct {
	ID         string
	UserID     string
	EntityType string
	EntityID   string
	EventType  string
	EventName  string
	Payload    map[string]any
	CreatedAt  time.Time
}

type EventResponse struct {
	ID         string         `json:"id"`
	EntityType string         `json:"entity_type"`
	EntityID   string         `json:"entity_id"`
	EventType  string         `json:"event_type"`
	EventName  string         `json:"event_name"`
	Payload    map[string]any `json:"payload"`
	CreatedAt  time.Time      `json:"created_at"`
}

type EventRecorder interface {
	Record(ctx context.Context, event Event) error
}

type Repository interface {
	Insert(ctx context.Context, event Event) error
	ListByEntity(ctx context.Context, userID, entityType, entityID string) ([]EventRecord, error)
	ListByUser(ctx context.Context, userID string, entityType *string, limit, offset int) ([]EventRecord, error)
}

type Service interface {
	EventRecorder
	GetEntityHistory(ctx context.Context, userID, entityType, entityID string) ([]EventResponse, error)
	GetUserHistory(ctx context.Context, userID string, entityType *string, limit, offset int) ([]EventResponse, error)
}
