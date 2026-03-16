package history

import (
	"context"
	"encoding/json"

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

func (r *Repo) Insert(ctx context.Context, event Event) error {
	const op apperr.Op = "Repo.Insert"
	payload, err := json.Marshal(event.Payload)
	if err != nil {
		return apperr.E(op, err)
	}
	_, err = r.pool.Exec(ctx,
		`INSERT INTO history_events (user_id, entity_type, entity_id, event_type, event_name, payload)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		event.UserID, event.EntityType, event.EntityID, event.EventType, event.EventName, payload,
	)
	return apperr.E(op, err)
}

func (r *Repo) ListByEntity(ctx context.Context, userID, entityType, entityID string) ([]EventRecord, error) {
	const op apperr.Op = "Repo.ListByEntity"
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, entity_type, entity_id, event_type, event_name, payload, created_at
		 FROM history_events
		 WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3
		 ORDER BY created_at DESC`,
		userID, entityType, entityID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()
	events, err := scanEvents(rows)
	return events, apperr.E(op, err)
}

func (r *Repo) ListByUser(ctx context.Context, userID string, entityType *string, limit, offset int) ([]EventRecord, error) {
	const op apperr.Op = "Repo.ListByUser"
	var rows pgx.Rows
	var err error

	if entityType != nil {
		rows, err = r.pool.Query(ctx,
			`SELECT id, user_id, entity_type, entity_id, event_type, event_name, payload, created_at
			 FROM history_events
			 WHERE user_id = $1 AND entity_type = $2
			 ORDER BY created_at DESC
			 LIMIT $3 OFFSET $4`,
			userID, *entityType, limit, offset,
		)
	} else {
		rows, err = r.pool.Query(ctx,
			`SELECT id, user_id, entity_type, entity_id, event_type, event_name, payload, created_at
			 FROM history_events
			 WHERE user_id = $1
			 ORDER BY created_at DESC
			 LIMIT $2 OFFSET $3`,
			userID, limit, offset,
		)
	}
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()
	events, err := scanEvents(rows)
	return events, apperr.E(op, err)
}

func scanEvents(rows pgx.Rows) ([]EventRecord, error) {
	var events []EventRecord
	for rows.Next() {
		var e EventRecord
		var payload []byte
		if err := rows.Scan(&e.ID, &e.UserID, &e.EntityType, &e.EntityID,
			&e.EventType, &e.EventName, &payload, &e.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(payload, &e.Payload); err != nil {
			e.Payload = map[string]any{}
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
