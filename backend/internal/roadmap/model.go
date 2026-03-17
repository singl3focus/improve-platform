package roadmap

import (
	"context"
	"errors"
	"time"
)

var (
	ErrRoadmapNotFound    = errors.New("roadmap not found")
	ErrRoadmapExists      = errors.New("roadmap already exists")
	ErrTopicNotFound      = errors.New("topic not found")
	ErrCycleDetected      = errors.New("dependency would create a cycle")
	ErrTopicBlocked       = errors.New("topic is blocked by incomplete prerequisites")
	ErrInvalidStatus      = errors.New("invalid status transition")
	ErrDependencyExists   = errors.New("dependency already exists")
	ErrDependencyNotFound = errors.New("dependency not found")
	ErrSelfDependency     = errors.New("topic cannot depend on itself")
)

// Domain models

type Roadmap struct {
	ID        string
	UserID    string
	Title     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Topic struct {
	ID            string
	UserID        string
	Title         string
	Description   string
	Status        string
	StartDate     *time.Time
	TargetDate    *time.Time
	CompletedDate *time.Time
	Position      int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type TopicDep struct {
	TopicID          string
	DependsOnTopicID string
	UserID           string
}

type TopicMetrics struct {
	TopicID         string
	TasksCount      int
	MaterialsCount  int
	ProgressPercent int
}

// Request types

type CreateRoadmapRequest struct {
	Title string `json:"title"`
}

type UpdateRoadmapRequest struct {
	Title string `json:"title"`
}

type CreateTopicRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Position    int    `json:"position"`
}

type CreateTopicWithDependencyRequest struct {
	Title            string `json:"title"`
	Description      string `json:"description"`
	Position         int    `json:"position"`
	DependsOnTopicID string `json:"depends_on_topic_id"`
}

type UpdateTopicRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	StartDate   *string `json:"start_date"`
	TargetDate  *string `json:"target_date"`
	Position    int     `json:"position"`
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}

type AddDependencyRequest struct {
	DependsOnTopicID string `json:"depends_on_topic_id"`
}

// Response types

type RoadmapResponse struct {
	ID           string                    `json:"id"`
	Title        string                    `json:"title"`
	CreatedAt    time.Time                 `json:"created_at"`
	UpdatedAt    time.Time                 `json:"updated_at"`
	Topics       []TopicResponse           `json:"topics"`
	Dependencies []TopicDependencyResponse `json:"dependencies"`
}

type TopicResponse struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Status          string    `json:"status"`
	StartDate       *string   `json:"start_date"`
	TargetDate      *string   `json:"target_date"`
	CompletedDate   *string   `json:"completed_date"`
	Position        int       `json:"position"`
	TasksCount      int       `json:"tasks_count"`
	MaterialsCount  int       `json:"materials_count"`
	ProgressPercent int       `json:"progress_percent"`
	IsBlocked       bool      `json:"is_blocked"`
	BlockReasons    []string  `json:"block_reasons"`
	Dependencies    []string  `json:"dependencies"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type TopicDependencyResponse struct {
	TopicID          string `json:"topic_id"`
	DependsOnTopicID string `json:"depends_on_topic_id"`
}

// Interfaces

type Repository interface {
	CreateRoadmap(ctx context.Context, userID, title string) (Roadmap, error)
	GetRoadmapByUserID(ctx context.Context, userID string) (Roadmap, error)
	UpdateRoadmapTitle(ctx context.Context, userID, title string) error

	CreateTopic(ctx context.Context, userID, title, description string, position int) (Topic, error)
	CreateTopicWithDependency(ctx context.Context, userID, title, description string, position int, dependsOnTopicID string) (Topic, error)
	GetTopicByID(ctx context.Context, id, userID string) (Topic, error)
	GetTopicsByUserID(ctx context.Context, userID string) ([]Topic, error)
	UpdateTopic(ctx context.Context, id, userID, title, description string, startDate, targetDate *time.Time, position int) error
	UpdateTopicStatus(ctx context.Context, id, userID, status string, startDate, completedDate *time.Time) error
	DeleteTopic(ctx context.Context, id, userID string) error

	AddDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	RemoveDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	GetDependenciesByUserID(ctx context.Context, userID string) ([]TopicDep, error)
	GetTopicMetricsByUserID(ctx context.Context, userID string) (map[string]TopicMetrics, error)
}

type Service interface {
	GetFullRoadmap(ctx context.Context, userID string) (RoadmapResponse, error)
	CreateRoadmap(ctx context.Context, userID string, req CreateRoadmapRequest) (RoadmapResponse, error)
	UpdateRoadmap(ctx context.Context, userID string, req UpdateRoadmapRequest) error

	CreateTopic(ctx context.Context, userID string, req CreateTopicRequest) (TopicResponse, error)
	CreateTopicWithDependency(ctx context.Context, userID string, req CreateTopicWithDependencyRequest) (TopicResponse, error)
	GetTopic(ctx context.Context, userID, topicID string) (TopicResponse, error)
	UpdateTopic(ctx context.Context, userID, topicID string, req UpdateTopicRequest) error
	UpdateTopicStatus(ctx context.Context, userID, topicID string, req UpdateStatusRequest) error
	DeleteTopic(ctx context.Context, userID, topicID string) error

	AddDependency(ctx context.Context, userID, topicID string, req AddDependencyRequest) error
	RemoveDependency(ctx context.Context, userID, topicID, depTopicID string) error
}
