package material

import (
	"context"
	"errors"
	"time"
)

var (
	ErrMaterialNotFound    = errors.New("material not found")
	ErrInvalidMaterialType = errors.New("invalid material type")
	ErrInvalidAmount       = errors.New("invalid material amount")
	ErrTopicNotFound       = errors.New("topic not found or does not belong to user")
)

const (
	MaterialTypeBook    = "book"
	MaterialTypeArticle = "article"
	MaterialTypeCourse  = "course"
	MaterialTypeVideo   = "video"

	MaterialUnitPages   = "pages"
	MaterialUnitLessons = "lessons"
	MaterialUnitHours   = "hours"
)

func unitByType(materialType string) (string, bool) {
	switch materialType {
	case MaterialTypeBook, MaterialTypeArticle:
		return MaterialUnitPages, true
	case MaterialTypeCourse:
		return MaterialUnitLessons, true
	case MaterialTypeVideo:
		return MaterialUnitHours, true
	default:
		return "", false
	}
}

func computeProgress(totalAmount, completedAmount int) int {
	if totalAmount <= 0 {
		return 0
	}
	if completedAmount <= 0 {
		return 0
	}
	if completedAmount >= totalAmount {
		return 100
	}
	return completedAmount * 100 / totalAmount
}

// Domain model

type Material struct {
	ID              string
	UserID          string
	TopicID         string
	Title           string
	Description     string
	URL             string
	Type            string
	Unit            string
	TotalAmount     int
	CompletedAmount int
	Position        int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Request types

type CreateRequest struct {
	TopicID         string `json:"topic_id"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	URL             string `json:"url"`
	Type            string `json:"type"`
	TotalAmount     int    `json:"total_amount"`
	CompletedAmount int    `json:"completed_amount"`
	Position        int    `json:"position"`
}

type UpdateRequest struct {
	Title           string `json:"title"`
	Description     string `json:"description"`
	URL             string `json:"url"`
	Type            string `json:"type"`
	TotalAmount     int    `json:"total_amount"`
	CompletedAmount int    `json:"completed_amount"`
	Position        int    `json:"position"`
}

// Response types

type MaterialResponse struct {
	ID              string    `json:"id"`
	TopicID         string    `json:"topic_id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	URL             string    `json:"url"`
	Type            string    `json:"type"`
	Unit            string    `json:"unit"`
	TotalAmount     int       `json:"total_amount"`
	CompletedAmount int       `json:"completed_amount"`
	Progress        int       `json:"progress"`
	Position        int       `json:"position"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Interfaces

type Repository interface {
	Create(ctx context.Context, m Material) (Material, error)
	GetByID(ctx context.Context, id, userID string) (Material, error)
	ListByTopic(ctx context.Context, topicID, userID string) ([]Material, error)
	Update(ctx context.Context, id, userID, title, description, url, materialType, unit string, totalAmount, completedAmount, position int) error
	Delete(ctx context.Context, id, userID string) error
}

type Service interface {
	CreateMaterial(ctx context.Context, userID string, req CreateRequest) (MaterialResponse, error)
	GetMaterial(ctx context.Context, userID, materialID string) (MaterialResponse, error)
	ListByTopic(ctx context.Context, userID, topicID string) ([]MaterialResponse, error)
	UpdateMaterial(ctx context.Context, userID, materialID string, req UpdateRequest) error
	DeleteMaterial(ctx context.Context, userID, materialID string) error
}
