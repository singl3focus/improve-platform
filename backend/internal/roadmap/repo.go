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

type directionalInsertPlan struct {
	insertPosition int
	shiftExisting  bool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

// --- Roadmap ---

func (r *Repo) CreateRoadmap(ctx context.Context, userID, title string, roadmapType RoadmapType) (Roadmap, error) {
	const op apperr.Op = "Repo.CreateRoadmap"
	var rm Roadmap
	err := r.pool.QueryRow(ctx,
		`INSERT INTO roadmaps (user_id, title, type) VALUES ($1, $2, $3)
		 RETURNING id, user_id, title, type, created_at, updated_at`,
		userID, title, roadmapType,
	).Scan(&rm.ID, &rm.UserID, &rm.Title, &rm.Type, &rm.CreatedAt, &rm.UpdatedAt)
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
		`SELECT id, user_id, title, type, created_at, updated_at
		 FROM roadmaps WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
		userID,
	).Scan(&rm.ID, &rm.UserID, &rm.Title, &rm.Type, &rm.CreatedAt, &rm.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return Roadmap{}, apperr.E(op, ErrRoadmapNotFound)
	}
	return rm, apperr.E(op, err)
}

func (r *Repo) GetRoadmapByID(ctx context.Context, id, userID string) (Roadmap, error) {
	const op apperr.Op = "Repo.GetRoadmapByID"
	var rm Roadmap
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, title, type, created_at, updated_at
		 FROM roadmaps WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&rm.ID, &rm.UserID, &rm.Title, &rm.Type, &rm.CreatedAt, &rm.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return Roadmap{}, apperr.E(op, ErrRoadmapNotFound)
	}
	return rm, apperr.E(op, err)
}

func (r *Repo) ListRoadmaps(ctx context.Context, userID string) ([]Roadmap, error) {
	const op apperr.Op = "Repo.ListRoadmaps"
	rows, err := r.pool.Query(ctx,
		`SELECT r.id, r.user_id, r.title, r.type, r.created_at, r.updated_at,
		        COALESCE(s.total, 0), COALESCE(s.completed, 0)
		 FROM roadmaps r
		 LEFT JOIN LATERAL (
		   SELECT COUNT(*) AS total,
		          COUNT(*) FILTER (WHERE status = 'completed') AS completed
		   FROM topics t WHERE t.roadmap_id = r.id AND t.user_id = r.user_id
		 ) s ON true
		 WHERE r.user_id = $1 ORDER BY r.created_at ASC`,
		userID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var roadmaps []Roadmap
	for rows.Next() {
		var rm Roadmap
		if err := rows.Scan(&rm.ID, &rm.UserID, &rm.Title, &rm.Type, &rm.CreatedAt, &rm.UpdatedAt,
			&rm.TotalTopics, &rm.CompletedTopics); err != nil {
			return nil, apperr.E(op, err)
		}
		roadmaps = append(roadmaps, rm)
	}
	return roadmaps, apperr.E(op, rows.Err())
}

func (r *Repo) UpdateRoadmapTitle(ctx context.Context, id, userID, title string) error {
	const op apperr.Op = "Repo.UpdateRoadmapTitle"
	tag, err := r.pool.Exec(ctx,
		`UPDATE roadmaps SET title = $1, updated_at = now() WHERE id = $2 AND user_id = $3`,
		title, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrRoadmapNotFound)
	}
	return nil
}

func (r *Repo) DeleteRoadmap(ctx context.Context, id, userID string) error {
	const op apperr.Op = "Repo.DeleteRoadmap"
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM roadmaps WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrRoadmapNotFound)
	}
	return nil
}

// --- Topics ---

func (r *Repo) CreateTopic(ctx context.Context, userID, roadmapID, title, description string, position int) (Topic, error) {
	const op apperr.Op = "Repo.CreateTopic"
	var t Topic
	err := r.pool.QueryRow(ctx,
		`INSERT INTO topics (user_id, roadmap_id, title, description, position)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, roadmap_id, title, description, goal, status, confidence,
		           start_date, target_date, completed_date, position, created_at, updated_at`,
		userID, roadmapID, title, description, position,
	).Scan(&t.ID, &t.UserID, &t.RoadmapID, &t.Title, &t.Description, &t.Goal, &t.Status, &t.Confidence,
		&t.StartDate, &t.TargetDate, &t.CompletedDate, &t.Position, &t.CreatedAt, &t.UpdatedAt)
	return t, apperr.E(op, err)
}

func (r *Repo) CreateTopicDirectional(ctx context.Context, userID, roadmapID, currentTopicID, title, description string, direction TopicCreateDirection) (Topic, error) {
	const op apperr.Op = "Repo.CreateTopicDirectional"

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Topic{}, apperr.E(op, err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	rows, err := tx.Query(ctx, `SELECT id, position FROM topics WHERE roadmap_id = $1 AND user_id = $2 FOR UPDATE`, roadmapID, userID)
	if err != nil {
		return Topic{}, apperr.E(op, err)
	}

	maxPosition := 0
	hasPositions := false
	currentPosition := 0
	currentFound := false

	for rows.Next() {
		var (
			topicID  string
			position int
		)
		if scanErr := rows.Scan(&topicID, &position); scanErr != nil {
			rows.Close()
			return Topic{}, apperr.E(op, scanErr)
		}

		if !hasPositions || position > maxPosition {
			maxPosition = position
			hasPositions = true
		}
		if topicID == currentTopicID {
			currentPosition = position
			currentFound = true
		}
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return Topic{}, apperr.E(op, err)
	}
	rows.Close()

	if !currentFound {
		return Topic{}, apperr.E(op, ErrTopicNotFound)
	}
	if !hasPositions {
		maxPosition = 0
	}

	insertPlan := resolveDirectionalInsertPlan(direction, currentPosition, maxPosition)

	if insertPlan.shiftExisting {
		if _, err = tx.Exec(ctx,
			`UPDATE topics
			 SET position = position + 1, updated_at = now()
			 WHERE roadmap_id = $1 AND user_id = $2 AND position >= $3`,
			roadmapID, userID, insertPlan.insertPosition,
		); err != nil {
			return Topic{}, apperr.E(op, err)
		}
	}

	var created Topic
	err = tx.QueryRow(ctx,
		`INSERT INTO topics (user_id, roadmap_id, title, description, position)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, roadmap_id, title, description, goal, status, confidence,
		           start_date, target_date, completed_date, position, created_at, updated_at`,
		userID, roadmapID, title, description, insertPlan.insertPosition,
	).Scan(&created.ID, &created.UserID, &created.RoadmapID, &created.Title, &created.Description, &created.Goal, &created.Status, &created.Confidence,
		&created.StartDate, &created.TargetDate, &created.CompletedDate, &created.Position, &created.CreatedAt, &created.UpdatedAt)
	if err != nil {
		return Topic{}, apperr.E(op, err)
	}

	if err = tx.Commit(ctx); err != nil {
		return Topic{}, apperr.E(op, err)
	}

	return created, nil
}

func resolveDirectionalInsertPlan(direction TopicCreateDirection, currentPosition, maxPosition int) directionalInsertPlan {
	switch direction {
	case TopicCreateDirectionLeft:
		return directionalInsertPlan{
			insertPosition: currentPosition,
			shiftExisting:  true,
		}
	case TopicCreateDirectionRight:
		return directionalInsertPlan{
			insertPosition: currentPosition + 1,
			shiftExisting:  true,
		}
	case TopicCreateDirectionBelow:
		return directionalInsertPlan{
			insertPosition: currentPosition,
			shiftExisting:  false,
		}
	default:
		return directionalInsertPlan{
			insertPosition: maxPosition + 1,
			shiftExisting:  false,
		}
	}
}

func (r *Repo) GetTopicByID(ctx context.Context, id, userID string) (Topic, error) {
	const op apperr.Op = "Repo.GetTopicByID"
	var t Topic
	err := r.pool.QueryRow(ctx,
		`SELECT id, user_id, roadmap_id, title, description, goal, status, confidence,
		        start_date, target_date, completed_date, position, created_at, updated_at
		 FROM topics WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&t.ID, &t.UserID, &t.RoadmapID, &t.Title, &t.Description, &t.Goal, &t.Status, &t.Confidence,
		&t.StartDate, &t.TargetDate, &t.CompletedDate, &t.Position, &t.CreatedAt, &t.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return Topic{}, apperr.E(op, ErrTopicNotFound)
	}
	return t, apperr.E(op, err)
}

func (r *Repo) GetTopicsByRoadmapID(ctx context.Context, roadmapID, userID string) ([]Topic, error) {
	const op apperr.Op = "Repo.GetTopicsByRoadmapID"
	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, roadmap_id, title, description, goal, status, confidence,
		        start_date, target_date, completed_date, position, created_at, updated_at
		 FROM topics WHERE roadmap_id = $1 AND user_id = $2 ORDER BY position, created_at`,
		roadmapID, userID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var topics []Topic
	for rows.Next() {
		var t Topic
		if err := rows.Scan(&t.ID, &t.UserID, &t.RoadmapID, &t.Title, &t.Description, &t.Goal, &t.Status, &t.Confidence,
			&t.StartDate, &t.TargetDate, &t.CompletedDate, &t.Position, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, apperr.E(op, err)
		}
		topics = append(topics, t)
	}
	return topics, apperr.E(op, rows.Err())
}

func (r *Repo) UpdateTopic(ctx context.Context, id, userID, title, description, goal string, startDate, targetDate *time.Time, position int) error {
	const op apperr.Op = "Repo.UpdateTopic"
	tag, err := r.pool.Exec(ctx,
		`UPDATE topics
		 SET title = $1, description = $2, goal = $3,
		     start_date = $4, target_date = $5, position = $6, updated_at = now()
		 WHERE id = $7 AND user_id = $8`,
		title, description, goal, startDate, targetDate, position, id, userID,
	)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTopicNotFound)
	}
	return nil
}

func (r *Repo) SetTopicConfidence(ctx context.Context, id, userID string, confidence int) error {
	const op apperr.Op = "Repo.SetTopicConfidence"
	tag, err := r.pool.Exec(ctx,
		`UPDATE topics SET confidence = $1, updated_at = now() WHERE id = $2 AND user_id = $3`,
		confidence, id, userID,
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
		return apperr.E(op, ErrDependencyNotFound)
	}
	return nil
}

func (r *Repo) GetDependenciesByRoadmapID(ctx context.Context, roadmapID, userID string) ([]TopicDep, error) {
	const op apperr.Op = "Repo.GetDependenciesByRoadmapID"
	rows, err := r.pool.Query(ctx,
		`SELECT td.topic_id, td.depends_on_topic_id, td.user_id
		 FROM topic_dependencies td
		 JOIN topics t ON t.id = td.topic_id
		 WHERE td.user_id = $1 AND t.roadmap_id = $2`,
		userID, roadmapID,
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

func (r *Repo) GetTopicMetricsByRoadmapID(ctx context.Context, roadmapID, userID string) (map[string]TopicMetrics, error) {
	const op apperr.Op = "Repo.GetTopicMetricsByRoadmapID"
	rows, err := r.pool.Query(ctx,
		`SELECT
			t.id,
			COALESCE(tc.tasks_count, 0) AS tasks_count,
			COALESCE(mc.materials_count, 0) AS materials_count,
			COALESCE(pc.progress_percent, 0) AS progress_percent
		 FROM topics t
		 LEFT JOIN (
			SELECT topic_id, COUNT(*)::int AS tasks_count
			FROM tasks
			WHERE user_id = $1 AND topic_id IS NOT NULL
			GROUP BY topic_id
		 ) tc ON tc.topic_id = t.id
		 LEFT JOIN (
			SELECT topic_id, COUNT(*)::int AS materials_count
			FROM materials
			WHERE user_id = $1
			GROUP BY topic_id
		 ) mc ON mc.topic_id = t.id
		 LEFT JOIN (
			SELECT
				topic_id,
				(
					COUNT(*) FILTER (WHERE status = 'done') * 100 /
					NULLIF(COUNT(*), 0)
				)::int AS progress_percent
			FROM tasks
			WHERE user_id = $1 AND topic_id IS NOT NULL
			GROUP BY topic_id
		 ) pc ON pc.topic_id = t.id
		 WHERE t.user_id = $1 AND t.roadmap_id = $2`,
		userID, roadmapID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	metrics := make(map[string]TopicMetrics)
	for rows.Next() {
		var m TopicMetrics
		if err := rows.Scan(&m.TopicID, &m.TasksCount, &m.MaterialsCount, &m.ProgressPercent); err != nil {
			return nil, apperr.E(op, err)
		}
		metrics[m.TopicID] = m
	}

	return metrics, apperr.E(op, rows.Err())
}
