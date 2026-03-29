package note

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "improve-platform/pkg/errors"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) Create(ctx context.Context, n Note) (Note, error) {
	const op apperr.Op = "note.Repo.Create"

	var created Note
	err := r.pool.QueryRow(ctx,
		`INSERT INTO topic_notes (user_id, topic_id, title, content, position)
		 VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) + 1 FROM topic_notes WHERE topic_id = $2 AND user_id = $1), 0))
		 RETURNING id, user_id, topic_id, title, content, position, created_at, updated_at`,
		n.UserID, n.TopicID, n.Title, n.Content).Scan(
		&created.ID, &created.UserID, &created.TopicID,
		&created.Title, &created.Content, &created.Position,
		&created.CreatedAt, &created.UpdatedAt)
	if err != nil {
		return Note{}, apperr.E(op, err)
	}
	return created, nil
}

func (r *Repo) GetByID(ctx context.Context, userID, noteID string) (Note, error) {
	const op apperr.Op = "note.Repo.GetByID"

	var n Note
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, topic_id, title, content, position, created_at, updated_at
		 FROM topic_notes
		 WHERE id = $1 AND user_id = $2`,
		noteID, userID).Scan(
		&n.ID, &n.UserID, &n.TopicID,
		&n.Title, &n.Content, &n.Position,
		&n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Note{}, apperr.E(op, ErrNoteNotFound)
		}
		return Note{}, apperr.E(op, err)
	}
	return n, nil
}

func (r *Repo) ListByTopic(ctx context.Context, userID, topicID string) ([]Note, error) {
	const op apperr.Op = "note.Repo.ListByTopic"

	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, topic_id, title, content, position, created_at, updated_at
		 FROM topic_notes
		 WHERE user_id = $1 AND topic_id = $2
		 ORDER BY position, created_at`,
		userID, topicID)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var notes []Note
	for rows.Next() {
		var n Note
		if err := rows.Scan(&n.ID, &n.UserID, &n.TopicID,
			&n.Title, &n.Content, &n.Position,
			&n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, apperr.E(op, err)
		}
		notes = append(notes, n)
	}
	return notes, apperr.E(op, rows.Err())
}

func (r *Repo) Update(ctx context.Context, userID, noteID, title, content string) (Note, error) {
	const op apperr.Op = "note.Repo.Update"

	var n Note
	err := r.pool.QueryRow(ctx,
		`UPDATE topic_notes
		 SET title = $3, content = $4, updated_at = now()
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, topic_id, title, content, position, created_at, updated_at`,
		noteID, userID, title, content).Scan(
		&n.ID, &n.UserID, &n.TopicID,
		&n.Title, &n.Content, &n.Position,
		&n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Note{}, apperr.E(op, ErrNoteNotFound)
		}
		return Note{}, apperr.E(op, err)
	}
	return n, nil
}

func (r *Repo) Delete(ctx context.Context, userID, noteID string) error {
	const op apperr.Op = "note.Repo.Delete"

	tag, err := r.pool.Exec(ctx,
		`DELETE FROM topic_notes WHERE id = $1 AND user_id = $2`,
		noteID, userID)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrNoteNotFound)
	}
	return nil
}
