package roadmap

import (
	"context"
	"errors"
	"time"
)

var (
	ErrRoadmapNotFound    = errors.New("roadmap not found")
	ErrRoadmapExists      = errors.New("roadmap already exists")
	ErrInvalidRoadmapType = errors.New("invalid roadmap type")
	ErrTopicNotFound      = errors.New("topic not found")
	ErrInvalidDirection   = errors.New("invalid create direction")
	ErrCycleDetected      = errors.New("dependency would create a cycle")
	ErrInvalidStatus      = errors.New("invalid status transition")
	ErrDependencyExists   = errors.New("dependency already exists")
	ErrDependencyNotFound = errors.New("dependency not found")
	ErrSelfDependency     = errors.New("topic cannot depend on itself")
	ErrInvalidConfidence  = errors.New("confidence must be between 1 and 5")
)

// Domain models

type RoadmapType string

const (
	RoadmapTypeGraph  RoadmapType = "graph"
	RoadmapTypeLevels RoadmapType = "levels"
	RoadmapTypeCycles RoadmapType = "cycles"
)

func (t RoadmapType) IsValid() bool {
	switch t {
	case RoadmapTypeGraph, RoadmapTypeLevels, RoadmapTypeCycles:
		return true
	default:
		return false
	}
}

type Roadmap struct {
	ID              string
	UserID          string
	Title           string
	Type            RoadmapType
	TotalTopics     int
	CompletedTopics int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Topic struct {
	ID            string
	UserID        string
	RoadmapID     string
	Title         string
	Description   string
	Status        string
	Confidence    *int
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
	Title string      `json:"title"`
	Type  RoadmapType `json:"type"`
}

type UpdateRoadmapRequest struct {
	Title string `json:"title"`
}

type CreateTopicRequest struct {
	Title             string               `json:"title"`
	Description       string               `json:"description"`
	Position          int                  `json:"position"`
	Direction         TopicCreateDirection `json:"direction"`
	RelativeToTopicID string               `json:"relative_to_topic_id"`
}

type TopicCreateDirection string

const (
	TopicCreateDirectionLeft  TopicCreateDirection = "left"
	TopicCreateDirectionRight TopicCreateDirection = "right"
	TopicCreateDirectionBelow TopicCreateDirection = "below"
)

func (d TopicCreateDirection) IsValid() bool {
	switch d {
	case TopicCreateDirectionLeft, TopicCreateDirectionRight, TopicCreateDirectionBelow:
		return true
	default:
		return false
	}
}

func (r CreateTopicRequest) IsDirectional() bool {
	return r.Direction != "" || r.RelativeToTopicID != ""
}

type UpdateTopicRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	StartDate   *string `json:"start_date"`
	TargetDate  *string `json:"target_date"`
	Position    int     `json:"position"`
}

type SetConfidenceRequest struct {
	Confidence int `json:"confidence"`
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}

type AddDependencyRequest struct {
	DependsOnTopicID string `json:"depends_on_topic_id"`
}

// Response types

type RoadmapListItem struct {
	ID              string      `json:"id"`
	Title           string      `json:"title"`
	Type            RoadmapType `json:"type"`
	TotalTopics     int         `json:"total_topics"`
	CompletedTopics int         `json:"completed_topics"`
	ProgressPercent int         `json:"progress_percent"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

type RoadmapResponse struct {
	ID           string                    `json:"id"`
	Title        string                    `json:"title"`
	Type         RoadmapType               `json:"type"`
	CreatedAt    time.Time                 `json:"created_at"`
	UpdatedAt    time.Time                 `json:"updated_at"`
	Topics       []TopicResponse           `json:"topics"`
	Dependencies []TopicDependencyResponse `json:"dependencies"`
}

type TopicResponse struct {
	ID              string    `json:"id"`
	RoadmapID       string    `json:"roadmap_id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Status          string    `json:"status"`
	Confidence      *int      `json:"confidence"`
	StartDate       *string   `json:"start_date"`
	TargetDate      *string   `json:"target_date"`
	CompletedDate   *string   `json:"completed_date"`
	Position        int       `json:"position"`
	TasksCount      int       `json:"tasks_count"`
	MaterialsCount  int       `json:"materials_count"`
	ProgressPercent int       `json:"progress_percent"`
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
	CreateRoadmap(ctx context.Context, userID, title string, roadmapType RoadmapType) (Roadmap, error)
	GetRoadmapByUserID(ctx context.Context, userID string) (Roadmap, error)
	GetRoadmapByID(ctx context.Context, id, userID string) (Roadmap, error)
	ListRoadmaps(ctx context.Context, userID string) ([]Roadmap, error)
	UpdateRoadmapTitle(ctx context.Context, id, userID, title string) error
	DeleteRoadmap(ctx context.Context, id, userID string) error

	CreateTopic(ctx context.Context, userID, roadmapID, title, description string, position int) (Topic, error)
	CreateTopicDirectional(ctx context.Context, userID, roadmapID, currentTopicID, title, description string, direction TopicCreateDirection) (Topic, error)
	GetTopicByID(ctx context.Context, id, userID string) (Topic, error)
	GetTopicsByRoadmapID(ctx context.Context, roadmapID, userID string) ([]Topic, error)
	UpdateTopic(ctx context.Context, id, userID, title, description string, startDate, targetDate *time.Time, position int) error
	SetTopicConfidence(ctx context.Context, id, userID string, confidence int) error
	UpdateTopicStatus(ctx context.Context, id, userID, status string, startDate, completedDate *time.Time) error
	DeleteTopic(ctx context.Context, id, userID string) error

	AddDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	RemoveDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error
	GetDependenciesByRoadmapID(ctx context.Context, roadmapID, userID string) ([]TopicDep, error)
	GetTopicMetricsByRoadmapID(ctx context.Context, roadmapID, userID string) (map[string]TopicMetrics, error)
}

type Service interface {
	ListRoadmaps(ctx context.Context, userID string) ([]RoadmapListItem, error)
	GetFullRoadmap(ctx context.Context, userID, roadmapID string) (RoadmapResponse, error)
	CreateRoadmap(ctx context.Context, userID string, req CreateRoadmapRequest) (RoadmapResponse, error)
	UpdateRoadmap(ctx context.Context, userID, roadmapID string, req UpdateRoadmapRequest) error
	DeleteRoadmap(ctx context.Context, userID, roadmapID string) error

	CreateTopic(ctx context.Context, userID, roadmapID string, req CreateTopicRequest) (TopicResponse, error)
	GetTopic(ctx context.Context, userID, topicID string) (TopicResponse, error)
	UpdateTopic(ctx context.Context, userID, topicID string, req UpdateTopicRequest) error
	UpdateTopicStatus(ctx context.Context, userID, topicID string, req UpdateStatusRequest) error
	DeleteTopic(ctx context.Context, userID, topicID string) error

	SetTopicConfidence(ctx context.Context, userID, topicID string, req SetConfidenceRequest) error
	AddDependency(ctx context.Context, userID, topicID string, req AddDependencyRequest) error
	RemoveDependency(ctx context.Context, userID, topicID, depTopicID string) error
}
