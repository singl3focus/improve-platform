package notify

import (
	"context"
	"time"
)

type DeadlineTask struct {
	ID       string
	UserID   string
	Title    string
	Status   string
	Deadline time.Time
	TopicID  *string
}

type DailySummary struct {
	Date    time.Time
	Overdue []DeadlineTask
	Today   []DeadlineTask
}

type TaskQuerier interface {
	GetDeadlineTasks(ctx context.Context, today time.Time) (overdue []DeadlineTask, dueToday []DeadlineTask, err error)
}

type Sender interface {
	SendDailySummary(ctx context.Context, summary DailySummary) error
}
