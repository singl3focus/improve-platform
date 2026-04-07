package notify

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/singl3focus/improve-platform/pkg/errors"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) GetDeadlineTasks(ctx context.Context, today time.Time) ([]DeadlineTask, []DeadlineTask, error) {
	const op apperr.Op = "Repo.GetDeadlineTasks"
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, title, status, deadline, topic_id
		 FROM tasks
		 WHERE deadline IS NOT NULL
		   AND status != 'done'
		   AND deadline <= $1
		 ORDER BY deadline, created_at`,
		today,
	)
	if err != nil {
		return nil, nil, apperr.E(op, err)
	}
	defer rows.Close()

	var overdue, dueToday []DeadlineTask
	for rows.Next() {
		var t DeadlineTask
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &t.Status, &t.Deadline, &t.TopicID); err != nil {
			return nil, nil, apperr.E(op, err)
		}
		dl := t.Deadline.Truncate(24 * time.Hour)
		td := today.Truncate(24 * time.Hour)
		if dl.Before(td) {
			overdue = append(overdue, t)
		} else {
			dueToday = append(dueToday, t)
		}
	}
	return overdue, dueToday, apperr.E(op, rows.Err())
}
