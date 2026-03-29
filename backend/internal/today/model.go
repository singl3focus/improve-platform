package today

import (
	"context"
	"errors"
	"time"
)

var (
	ErrPlanNotFound  = errors.New("daily plan not found")
	ErrTaskNotInPlan = errors.New("task not in daily plan")
)

// Domain models

type DailyPlan struct {
	ID         string
	UserID     string
	Date       time.Time
	Reflection *string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type DailyPlanItem struct {
	ID          string
	DailyPlanID string
	TaskID      string
	Position    int
	IsCompleted bool
}

// Response types

type TodayTask struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	TopicTitle  *string `json:"topic_title"`
	Deadline    *string `json:"deadline"`
	Status      string  `json:"status"`
	IsCompleted bool    `json:"is_completed"`
	Position    int     `json:"position"`
}

type TodayMaterial struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	TopicTitle      string `json:"topic_title"`
	Type            string `json:"type"`
	CompletedAmount int    `json:"completed_amount"`
	TotalAmount     int    `json:"total_amount"`
	ProgressPercent int    `json:"progress_percent"`
}

type TodayResponse struct {
	Date            string         `json:"date"`
	Tasks           []TodayTask    `json:"tasks"`
	CurrentMaterial *TodayMaterial `json:"current_material"`
	Reflection      *string        `json:"reflection"`
}

// Request types

type SetTodayTasksRequest struct {
	TaskIDs []string `json:"task_ids"`
}

type ToggleTaskRequest struct {
	TaskID      string `json:"task_id"`
	IsCompleted bool   `json:"is_completed"`
}

type SaveReflectionRequest struct {
	Reflection string `json:"reflection"`
}

// Interfaces

type Repository interface {
	GetOrCreatePlan(ctx context.Context, userID string, date time.Time) (DailyPlan, error)
	SetPlanItems(ctx context.Context, planID string, taskIDs []string) error
	TogglePlanItem(ctx context.Context, planID, taskID string, isCompleted bool) error
	SaveReflection(ctx context.Context, planID, reflection string) error
	GetTodayTasks(ctx context.Context, userID string, date time.Time) ([]TodayTask, error)
	GetCurrentMaterial(ctx context.Context, userID string) (*TodayMaterial, error)
	GetPlanItemCount(ctx context.Context, planID string) (int, error)
}

type FocusTaskProvider interface {
	GetFocusTasks(ctx context.Context, userID string) ([]FocusTaskRef, error)
}

type FocusTaskRef struct {
	ID string
}

type Service interface {
	GetToday(ctx context.Context, userID string) (TodayResponse, error)
	SetTasks(ctx context.Context, userID string, req SetTodayTasksRequest) error
	ToggleTask(ctx context.Context, userID, taskID string, isCompleted bool) error
	SaveReflection(ctx context.Context, userID string, req SaveReflectionRequest) error
}
