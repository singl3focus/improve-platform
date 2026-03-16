package roadmap

import (
	"context"
	"errors"
	"time"
)

var (
	ErrRoadmapNotFound  = errors.New("roadmap not found")
	ErrRoadmapExists    = errors.New("roadmap already exists")
	ErrStageNotFound    = errors.New("stage not found")
	ErrTopicNotFound    = errors.New("topic not found")
	ErrCycleDetected    = errors.New("dependency would create a cycle")
	ErrTopicBlocked     = errors.New("topic is blocked by incomplete prerequisites")
	ErrInvalidStatus    = errors.New("invalid status transition")
	ErrDependencyExists = errors.New("dependency already exists")
	ErrSelfDependency   = errors.New("topic cannot depend on itself")
)

// Domain models

type Roadmap struct {
	ID        string
	UserID    string
	Title     string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Stage struct {
	ID        string
	RoadmapID string
	UserID    string
	Title     string
	Position  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Topic struct {
	ID            string
	UserID        string
	StageID       string
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

// Request types

type CreateRoadmapRequest struct {
	Title string `json:"title"`
}

type UpdateRoadmapRequest struct {
	Title string `json:"title"`
}

type CreateStageRequest struct {
	Title    string `json:"title"`
	Position int    `json:"position"`
}

type UpdateStageRequest struct {
	Title    string `json:"title"`
	Position int    `json:"position"`
}

type CreateTopicRequest struct {
	StageID     string `json:"stage_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Position    int    `json:"position"`
}

type UpdateTopicRequest struct {
	StageID     string  `json:"stage_id"`
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
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Stages    []StageResponse `json:"stages"`
}

type StageResponse struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Position  int             `json:"position"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Topics    []TopicResponse `json:"topics"`
}

type TopicResponse struct {
	ID            string    `json:"id"`
	StageID       string    `json:"stage_id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Status        string    `json:"status"`
	StartDate     *string   `json:"start_date"`
	TargetDate    *string   `json:"target_date"`
	CompletedDate *string   `json:"completed_date"`
	Position      int       `json:"position"`
	IsBlocked     bool      `json:"is_blocked"`
	BlockReasons  []string  `json:"block_reasons"`
	Dependencies  []string  `json:"dependencies"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Interfaces

type Repository interface {
	CreateRoadmap(ctx context.Context, userID, title string) (Roadmap, error)
	GetRoadmapByUserID(ctx context.Context, userID string) (Roadmap, error)
	UpdateRoadmapTitle(ctx context.Context, userID, title string) error

	CreateStage(ctx context.Context, roadmapID, userID, title string, position int) (Stage, error)
	GetStagesByUserID(ctx context.Context, userID string) ([]Stage, error)
	UpdateStage(ctx context.Context, id, userID, title string, position int) error
	DeleteStage(ctx context.Context, id, userID string) error

	CreateTopic(ctx context.Context, userID, stageID, title, description string, position int) (Topic, error)
	GetTopicByID(ctx context.Context, id, userID string) (Topic, error)
	GetTopicsByUserID(ctx context.Context, userID string) ([]Topic, error)
	UpdateTopic(ctx context.Context, id, userID, stageID, title, description string, startDate, targetDate *time.Time, position int) error
	UpdateTopicStatus(ctx context.Context, id, userID, status string, startDate, completedDate *time.Time) error
	DeleteTopic(ctx context.Context, id, userID string) error

	AddDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	RemoveDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	GetDependenciesByUserID(ctx context.Context, userID string) ([]TopicDep, error)
}

type Service interface {
	GetFullRoadmap(ctx context.Context, userID string) (RoadmapResponse, error)
	CreateRoadmap(ctx context.Context, userID string, req CreateRoadmapRequest) (RoadmapResponse, error)
	UpdateRoadmap(ctx context.Context, userID string, req UpdateRoadmapRequest) error

	CreateStage(ctx context.Context, userID string, req CreateStageRequest) (StageResponse, error)
	UpdateStage(ctx context.Context, userID, stageID string, req UpdateStageRequest) error
	DeleteStage(ctx context.Context, userID, stageID string) error

	CreateTopic(ctx context.Context, userID string, req CreateTopicRequest) (TopicResponse, error)
	GetTopic(ctx context.Context, userID, topicID string) (TopicResponse, error)
	UpdateTopic(ctx context.Context, userID, topicID string, req UpdateTopicRequest) error
	UpdateTopicStatus(ctx context.Context, userID, topicID string, req UpdateStatusRequest) error
	DeleteTopic(ctx context.Context, userID, topicID string) error

	AddDependency(ctx context.Context, userID, topicID string, req AddDependencyRequest) error
	RemoveDependency(ctx context.Context, userID, topicID, depTopicID string) error
}
