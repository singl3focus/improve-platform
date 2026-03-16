package task

import (
	"context"
	"errors"
	"time"
)

var (
	ErrTaskNotFound  = errors.New("task not found")
	ErrInvalidStatus = errors.New("invalid task status transition")
)

// Domain model

type Task struct {
	ID          string
	UserID      string
	TopicID     *string
	Title       string
	Description string
	Status      string // new, in_progress, paused, done
	Deadline    *time.Time
	Position    int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Request types

type CreateRequest struct {
	TopicID     *string `json:"topic_id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Deadline    *string `json:"deadline"`
	Position    int     `json:"position"`
}

type UpdateRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Deadline    *string `json:"deadline"`
	Position    int     `json:"position"`
}

type UpdateStatusRequest struct {
	Status string `json:"status"`
}

// Response types

type TaskResponse struct {
	ID          string    `json:"id"`
	TopicID     *string   `json:"topic_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	Deadline    *string   `json:"deadline"`
	Position    int       `json:"position"`
	IsOverdue   bool      `json:"is_overdue"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TopicTasksResponse struct {
	TopicID string         `json:"topic_id"`
	Total   int            `json:"total"`
	Done    int            `json:"done"`
	Percent int            `json:"percent"`
	Tasks   []TaskResponse `json:"tasks"`
}

// Interfaces

type Repository interface {
	Create(ctx context.Context, t Task) (Task, error)
	GetByID(ctx context.Context, id, userID string) (Task, error)
	ListByUser(ctx context.Context, userID string, topicID *string) ([]Task, error)
	Update(ctx context.Context, id, userID, title, description string, deadline *time.Time, position int) error
	UpdateStatus(ctx context.Context, id, userID, status string) error
	Delete(ctx context.Context, id, userID string) error
	CountByTopic(ctx context.Context, topicID, userID string) (total int, done int, err error)
}

// TopicStatusUpdater allows the task module to auto-sync topic status.
type TopicStatusUpdater interface {
	GetTopicStatus(ctx context.Context, topicID, userID string) (string, error)
	SetTopicInProgress(ctx context.Context, topicID, userID string) error
	SetTopicCompleted(ctx context.Context, topicID, userID string) error
}

type Service interface {
	CreateTask(ctx context.Context, userID string, req CreateRequest) (TaskResponse, error)
	GetTask(ctx context.Context, userID, taskID string) (TaskResponse, error)
	ListTasks(ctx context.Context, userID string, topicID *string) ([]TaskResponse, error)
	UpdateTask(ctx context.Context, userID, taskID string, req UpdateRequest) error
	UpdateTaskStatus(ctx context.Context, userID, taskID string, req UpdateStatusRequest) error
	DeleteTask(ctx context.Context, userID, taskID string) error
	GetTopicTasks(ctx context.Context, userID, topicID string) (TopicTasksResponse, error)
}
