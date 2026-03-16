package material

import (
	"context"
	"errors"
	"time"
)

var (
	ErrMaterialNotFound = errors.New("material not found")
	ErrInvalidProgress  = errors.New("progress must be between 0 and 100")
	ErrTopicNotFound    = errors.New("topic not found or does not belong to user")
)

// Domain model

type Material struct {
	ID          string
	UserID      string
	TopicID     string
	Title       string
	Description string
	Progress    int // 0-100
	Position    int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Request types

type CreateRequest struct {
	TopicID     string `json:"topic_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Progress    int    `json:"progress"`
	Position    int    `json:"position"`
}

type UpdateRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Progress    int    `json:"progress"`
	Position    int    `json:"position"`
}

// Response types

type MaterialResponse struct {
	ID          string    `json:"id"`
	TopicID     string    `json:"topic_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Progress    int       `json:"progress"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Interfaces

type Repository interface {
	Create(ctx context.Context, m Material) (Material, error)
	GetByID(ctx context.Context, id, userID string) (Material, error)
	ListByTopic(ctx context.Context, topicID, userID string) ([]Material, error)
	Update(ctx context.Context, id, userID, title, description string, progress, position int) error
	Delete(ctx context.Context, id, userID string) error
}

type Service interface {
	CreateMaterial(ctx context.Context, userID string, req CreateRequest) (MaterialResponse, error)
	GetMaterial(ctx context.Context, userID, materialID string) (MaterialResponse, error)
	ListByTopic(ctx context.Context, userID, topicID string) ([]MaterialResponse, error)
	UpdateMaterial(ctx context.Context, userID, materialID string, req UpdateRequest) error
	DeleteMaterial(ctx context.Context, userID, materialID string) error
}
