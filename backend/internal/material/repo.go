package material

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "improve-platform/pkg/errors"
)

const foreignKeyViolation = "23503"

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) Create(ctx context.Context, m Material) (Material, error) {
	const op apperr.Op = "Repo.Create"
	var created Material
	err := r.pool.QueryRow(ctx,
		`INSERT INTO materials (user_id, topic_id, title, description, url, type, unit, total_amount, completed_amount, position)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING id, user_id, topic_id, title, description, url, type, unit, total_amount, completed_amount, position, created_at, updated_at`,
		m.UserID, m.TopicID, m.Title, m.Description, m.URL, m.Type, m.Unit, m.TotalAmount, m.CompletedAmount, m.Position,
	).Scan(&created.ID, &created.UserID, &created.TopicID, &created.Title, &created.Description,
		&created.URL, &created.Type, &created.Unit, &created.TotalAmount, &created.CompletedAmount,
		&created.Position, &created.CreatedAt, &created.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if apperr.As(err, &pgErr) && pgErr.Code == foreignKeyViolation {
			return Material{}, apperr.E(op, ErrTopicNotFound)
		}
		return Material{}, apperr.E(op, err)
	}
	return created, nil
}

func (r *Repo) GetByID(ctx context.Context, id, userID string) (Material, error) {
	const op apperr.Op = "Repo.GetByID"
	var m Material
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, topic_id, title, description, url, type, unit, total_amount, completed_amount, position, created_at, updated_at
		 FROM materials WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&m.ID, &m.UserID, &m.TopicID, &m.Title, &m.Description,
		&m.URL, &m.Type, &m.Unit, &m.TotalAmount, &m.CompletedAmount, &m.Position, &m.CreatedAt, &m.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return Material{}, apperr.E(op, ErrMaterialNotFound)
	}
	return m, apperr.E(op, err)
}

func (r *Repo) ListByTopic(ctx context.Context, topicID, userID string) ([]Material, error) {
	const op apperr.Op = "Repo.ListByTopic"
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, topic_id, title, description, url, type, unit, total_amount, completed_amount, position, created_at, updated_at
		 FROM materials WHERE topic_id = $1 AND user_id = $2
		 ORDER BY position, created_at`,
		topicID, userID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var materials []Material
	for rows.Next() {
		var m Material
		if err := rows.Scan(&m.ID, &m.UserID, &m.TopicID, &m.Title, &m.Description,
			&m.URL, &m.Type, &m.Unit, &m.TotalAmount, &m.CompletedAmount,
			&m.Position, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, apperr.E(op, err)
		}
		materials = append(materials, m)
	}
	return materials, apperr.E(op, rows.Err())
}

func (r *Repo) Update(ctx context.Context, id, userID, title, description, url, materialType, unit string, totalAmount, completedAmount, position int) error {
	const op apperr.Op = "Repo.Update"
	tag, err := r.pool.Exec(ctx,
		`UPDATE materials
		 SET title = $1, description = $2, url = $3, type = $4, unit = $5, total_amount = $6, completed_amount = $7, position = $8, updated_at = now()
		 WHERE id = $9 AND user_id = $10`,
		title, description, url, materialType, unit, totalAmount, completedAmount, position, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrMaterialNotFound)
	}
	return nil
}

func (r *Repo) Delete(ctx context.Context, id, userID string) error {
	const op apperr.Op = "Repo.Delete"
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM materials WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrMaterialNotFound)
	}
	return nil
}
