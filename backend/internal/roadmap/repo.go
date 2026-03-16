package roadmap

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "improve-platform/pkg/errors"
)

const uniqueViolation = "23505"

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// --- Roadmap ---

func (r *Repo) CreateRoadmap(ctx context.Context, userID, title string) (Roadmap, error) {
	const op apperr.Op = "Repo.CreateRoadmap"
	var rm Roadmap
	err := r.pool.QueryRow(ctx,
		`INSERT INTO roadmaps (user_id, title) VALUES ($1, $2)
		 RETURNING id, user_id, title, created_at, updated_at`,
		userID, title,
	).Scan(&rm.ID, &rm.UserID, &rm.Title, &rm.CreatedAt, &rm.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if apperr.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return Roadmap{}, apperr.E(op, ErrRoadmapExists)
		}
		return Roadmap{}, apperr.E(op, err)
	}
	return rm, nil
}

func (r *Repo) GetRoadmapByUserID(ctx context.Context, userID string) (Roadmap, error) {
	const op apperr.Op = "Repo.GetRoadmapByUserID"
	var rm Roadmap
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, title, created_at, updated_at
		 FROM roadmaps WHERE user_id = $1`,
		userID,
	).Scan(&rm.ID, &rm.UserID, &rm.Title, &rm.CreatedAt, &rm.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return Roadmap{}, apperr.E(op, ErrRoadmapNotFound)
	}
	return rm, apperr.E(op, err)
}

func (r *Repo) UpdateRoadmapTitle(ctx context.Context, userID, title string) error {
	const op apperr.Op = "Repo.UpdateRoadmapTitle"
	tag, err := r.pool.Exec(ctx,
		`UPDATE roadmaps SET title = $1, updated_at = now() WHERE user_id = $2`,
		title, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrRoadmapNotFound)
	}
	return nil
}

// --- Stages ---

func (r *Repo) CreateStage(ctx context.Context, roadmapID, userID, title string, position int) (Stage, error) {
	const op apperr.Op = "Repo.CreateStage"
	var s Stage
	err := r.pool.QueryRow(ctx,
		`INSERT INTO stages (roadmap_id, user_id, title, position)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, roadmap_id, user_id, title, position, created_at, updated_at`,
		roadmapID, userID, title, position,
	).Scan(&s.ID, &s.RoadmapID, &s.UserID, &s.Title, &s.Position, &s.CreatedAt, &s.UpdatedAt)
	return s, apperr.E(op, err)
}

func (r *Repo) GetStagesByUserID(ctx context.Context, userID string) ([]Stage, error) {
	const op apperr.Op = "Repo.GetStagesByUserID"
	rows, err := r.pool.Query(ctx,
		`SELECT id, roadmap_id, user_id, title, position, created_at, updated_at
		 FROM stages WHERE user_id = $1 ORDER BY position, created_at`,
		userID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var stages []Stage
	for rows.Next() {
		var s Stage
		if err := rows.Scan(&s.ID, &s.RoadmapID, &s.UserID, &s.Title, &s.Position, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, apperr.E(op, err)
		}
		stages = append(stages, s)
	}
	return stages, apperr.E(op, rows.Err())
}

func (r *Repo) UpdateStage(ctx context.Context, id, userID, title string, position int) error {
	const op apperr.Op = "Repo.UpdateStage"
	tag, err := r.pool.Exec(ctx,
		`UPDATE stages SET title = $1, position = $2, updated_at = now()
		 WHERE id = $3 AND user_id = $4`,
		title, position, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrStageNotFound)
	}
	return nil
}

func (r *Repo) DeleteStage(ctx context.Context, id, userID string) error {
	const op apperr.Op = "Repo.DeleteStage"
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM stages WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrStageNotFound)
	}
	return nil
}

// --- Topics ---

func (r *Repo) CreateTopic(ctx context.Context, userID, stageID, title, description string, position int) (Topic, error) {
	const op apperr.Op = "Repo.CreateTopic"
	var t Topic
	err := r.pool.QueryRow(ctx,
		`INSERT INTO topics (user_id, stage_id, title, description, position)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, stage_id, title, description, status,
		           start_date, target_date, completed_date, position, created_at, updated_at`,
		userID, stageID, title, description, position,
	).Scan(&t.ID, &t.UserID, &t.StageID, &t.Title, &t.Description, &t.Status,
		&t.StartDate, &t.TargetDate, &t.CompletedDate, &t.Position, &t.CreatedAt, &t.UpdatedAt)
	return t, apperr.E(op, err)
}

func (r *Repo) GetTopicByID(ctx context.Context, id, userID string) (Topic, error) {
	const op apperr.Op = "Repo.GetTopicByID"
	var t Topic
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, stage_id, title, description, status,
		        start_date, target_date, completed_date, position, created_at, updated_at
		 FROM topics WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&t.ID, &t.UserID, &t.StageID, &t.Title, &t.Description, &t.Status,
		&t.StartDate, &t.TargetDate, &t.CompletedDate, &t.Position, &t.CreatedAt, &t.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return Topic{}, apperr.E(op, ErrTopicNotFound)
	}
	return t, apperr.E(op, err)
}

func (r *Repo) GetTopicsByUserID(ctx context.Context, userID string) ([]Topic, error) {
	const op apperr.Op = "Repo.GetTopicsByUserID"
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, stage_id, title, description, status,
		        start_date, target_date, completed_date, position, created_at, updated_at
		 FROM topics WHERE user_id = $1 ORDER BY position, created_at`,
		userID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var topics []Topic
	for rows.Next() {
		var t Topic
		if err := rows.Scan(&t.ID, &t.UserID, &t.StageID, &t.Title, &t.Description, &t.Status,
			&t.StartDate, &t.TargetDate, &t.CompletedDate, &t.Position, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, apperr.E(op, err)
		}
		topics = append(topics, t)
	}
	return topics, apperr.E(op, rows.Err())
}

func (r *Repo) UpdateTopic(ctx context.Context, id, userID, stageID, title, description string, startDate, targetDate *time.Time, position int) error {
	const op apperr.Op = "Repo.UpdateTopic"
	tag, err := r.pool.Exec(ctx,
		`UPDATE topics
		 SET stage_id = $1, title = $2, description = $3,
		     start_date = $4, target_date = $5, position = $6, updated_at = now()
		 WHERE id = $7 AND user_id = $8`,
		stageID, title, description, startDate, targetDate, position, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTopicNotFound)
	}
	return nil
}

func (r *Repo) UpdateTopicStatus(ctx context.Context, id, userID, status string, startDate, completedDate *time.Time) error {
	const op apperr.Op = "Repo.UpdateTopicStatus"
	tag, err := r.pool.Exec(ctx,
		`UPDATE topics
		 SET status = $1, start_date = COALESCE($2, start_date),
		     completed_date = $3, updated_at = now()
		 WHERE id = $4 AND user_id = $5`,
		status, startDate, completedDate, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTopicNotFound)
	}
	return nil
}

func (r *Repo) DeleteTopic(ctx context.Context, id, userID string) error {
	const op apperr.Op = "Repo.DeleteTopic"
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM topics WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTopicNotFound)
	}
	return nil
}

// --- Dependencies ---

func (r *Repo) AddDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error {
	const op apperr.Op = "Repo.AddDependency"
	_, err := r.pool.Exec(ctx,
		`INSERT INTO topic_dependencies (topic_id, depends_on_topic_id, user_id)
		 VALUES ($1, $2, $3)`,
		topicID, dependsOnTopicID, userID,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if apperr.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return apperr.E(op, ErrDependencyExists)
		}
		return apperr.E(op, err)
	}
	return nil
}

func (r *Repo) RemoveDependency(ctx context.Context, topicID, dependsOnTopicID, userID string) error {
	const op apperr.Op = "Repo.RemoveDependency"
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM topic_dependencies
		 WHERE topic_id = $1 AND depends_on_topic_id = $2 AND user_id = $3`,
		topicID, dependsOnTopicID, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTopicNotFound)
	}
	return nil
}

func (r *Repo) GetDependenciesByUserID(ctx context.Context, userID string) ([]TopicDep, error) {
	const op apperr.Op = "Repo.GetDependenciesByUserID"
	rows, err := r.pool.Query(ctx,
		`SELECT topic_id, depends_on_topic_id, user_id
		 FROM topic_dependencies WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var deps []TopicDep
	for rows.Next() {
		var d TopicDep
		if err := rows.Scan(&d.TopicID, &d.DependsOnTopicID, &d.UserID); err != nil {
			return nil, apperr.E(op, err)
		}
		deps = append(deps, d)
	}
	return deps, apperr.E(op, rows.Err())
}
