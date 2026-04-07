package task

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "github.com/singl3focus/improve-platform/pkg/errors"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

const foreignKeyViolation = "23503"

func (r *Repo) Create(ctx context.Context, t Task) (Task, error) {
	const op apperr.Op = "Repo.Create"
	var created Task
	err := r.pool.QueryRow(ctx,
		`INSERT INTO tasks (user_id, topic_id, title, description, deadline, position)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, topic_id, title, description, status,
		           deadline, position, created_at, updated_at`,
		t.UserID, t.TopicID, t.Title, t.Description, t.Deadline, t.Position,
	).Scan(&created.ID, &created.UserID, &created.TopicID, &created.Title, &created.Description,
		&created.Status, &created.Deadline, &created.Position, &created.CreatedAt, &created.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if apperr.As(err, &pgErr) && pgErr.Code == foreignKeyViolation {
			return Task{}, apperr.E(op, ErrTopicNotFound)
		}
		return Task{}, apperr.E(op, err)
	}
	return created, nil
}

func (r *Repo) GetByID(ctx context.Context, id, userID string) (Task, error) {
	const op apperr.Op = "Repo.GetByID"
	var t Task
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, topic_id, title, description, status,
		        deadline, position, created_at, updated_at
		 FROM tasks WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&t.ID, &t.UserID, &t.TopicID, &t.Title, &t.Description,
		&t.Status, &t.Deadline, &t.Position, &t.CreatedAt, &t.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return Task{}, apperr.E(op, ErrTaskNotFound)
	}
	return t, apperr.E(op, err)
}

func (r *Repo) ListByUser(ctx context.Context, userID string, topicID *string) ([]Task, error) {
	const op apperr.Op = "Repo.ListByUser"
	var rows pgx.Rows
	var err error

	if topicID != nil {
		rows, err = r.pool.Query(ctx,
			`SELECT id, user_id, topic_id, title, description, status,
			        deadline, position, created_at, updated_at
			 FROM tasks WHERE user_id = $1 AND topic_id = $2
			 ORDER BY position, created_at`,
			userID, *topicID,
		)
	} else {
		rows, err = r.pool.Query(ctx,
			`SELECT id, user_id, topic_id, title, description, status,
			        deadline, position, created_at, updated_at
			 FROM tasks WHERE user_id = $1
			 ORDER BY position, created_at`,
			userID,
		)
	}
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.UserID, &t.TopicID, &t.Title, &t.Description,
			&t.Status, &t.Deadline, &t.Position, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, apperr.E(op, err)
		}
		tasks = append(tasks, t)
	}
	return tasks, apperr.E(op, rows.Err())
}

func (r *Repo) Update(
	ctx context.Context,
	id,
	userID,
	title,
	description string,
	deadline *time.Time,
	position int,
	topicID *string,
	updateTopicID bool,
) error {
	const op apperr.Op = "Repo.Update"
	tag, err := r.pool.Exec(ctx,
		`UPDATE tasks
		 SET title = $1,
		     description = $2,
		     deadline = $3,
		     position = $4,
		     topic_id = CASE WHEN $5 THEN $6::uuid ELSE topic_id END,
		     updated_at = now()
		 WHERE id = $7 AND user_id = $8`,
		title, description, deadline, position, updateTopicID, topicID, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTaskNotFound)
	}
	return nil
}

func (r *Repo) UpdateStatus(ctx context.Context, id, userID, status string) error {
	const op apperr.Op = "Repo.UpdateStatus"
	tag, err := r.pool.Exec(ctx,
		`UPDATE tasks SET status = $1, updated_at = now()
		 WHERE id = $2 AND user_id = $3`,
		status, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTaskNotFound)
	}
	return nil
}

func (r *Repo) Delete(ctx context.Context, id, userID string) error {
	const op apperr.Op = "Repo.Delete"
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTaskNotFound)
	}
	return nil
}

func (r *Repo) CountByTopic(ctx context.Context, topicID, userID string) (int, int, error) {
	const op apperr.Op = "Repo.CountByTopic"
	var total, done int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'done')
		 FROM tasks WHERE topic_id = $1 AND user_id = $2`,
		topicID, userID,
	).Scan(&total, &done)
	return total, done, apperr.E(op, err)
}
