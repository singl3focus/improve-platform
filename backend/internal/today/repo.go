package today

import (
	"context"
	"time"

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

func (r *Repo) GetOrCreatePlan(ctx context.Context, userID string, date time.Time) (DailyPlan, error) {
	const op apperr.Op = "today.Repo.GetOrCreatePlan"

	_, err := r.pool.Exec(ctx,
		`INSERT INTO daily_plans (user_id, date)
		 VALUES ($1, $2)
		 ON CONFLICT (user_id, date) DO NOTHING`,
		userID, date)
	if err != nil {
		return DailyPlan{}, apperr.E(op, err)
	}

	var plan DailyPlan
	err = r.pool.QueryRow(ctx,
		`SELECT id, user_id, date, reflection, created_at, updated_at
		 FROM daily_plans
		 WHERE user_id = $1 AND date = $2`,
		userID, date).Scan(
		&plan.ID, &plan.UserID, &plan.Date, &plan.Reflection,
		&plan.CreatedAt, &plan.UpdatedAt)
	if err != nil {
		return DailyPlan{}, apperr.E(op, err)
	}
	return plan, nil
}

func (r *Repo) SetPlanItems(ctx context.Context, planID string, taskIDs []string) error {
	const op apperr.Op = "today.Repo.SetPlanItems"

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return apperr.E(op, err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM daily_plan_items WHERE daily_plan_id = $1`, planID)
	if err != nil {
		return apperr.E(op, err)
	}

	for i, taskID := range taskIDs {
		_, err = tx.Exec(ctx,
			`INSERT INTO daily_plan_items (daily_plan_id, task_id, position)
			 VALUES ($1, $2, $3)`,
			planID, taskID, i)
		if err != nil {
			return apperr.E(op, err)
		}
	}

	return apperr.E(op, tx.Commit(ctx))
}

func (r *Repo) TogglePlanItem(ctx context.Context, planID, taskID string, isCompleted bool) error {
	const op apperr.Op = "today.Repo.TogglePlanItem"

	tag, err := r.pool.Exec(ctx,
		`UPDATE daily_plan_items
		 SET is_completed = $3
		 WHERE daily_plan_id = $1 AND task_id = $2`,
		planID, taskID, isCompleted)
	if err != nil {
		return apperr.E(op, err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.E(op, ErrTaskNotInPlan)
	}
	return nil
}

func (r *Repo) SaveReflection(ctx context.Context, planID, reflection string) error {
	const op apperr.Op = "today.Repo.SaveReflection"

	_, err := r.pool.Exec(ctx,
		`UPDATE daily_plans SET reflection = $2, updated_at = now() WHERE id = $1`,
		planID, reflection)
	return apperr.E(op, err)
}

func (r *Repo) GetTodayTasks(ctx context.Context, userID string, date time.Time) ([]TodayTask, error) {
	const op apperr.Op = "today.Repo.GetTodayTasks"

	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.title, top.title AS topic_title, t.deadline, t.status,
		        dpi.is_completed, dpi.position
		 FROM daily_plan_items dpi
		 JOIN daily_plans dp ON dp.id = dpi.daily_plan_id
		 JOIN tasks t ON t.id = dpi.task_id
		 LEFT JOIN topics top ON top.id = t.topic_id AND top.user_id = t.user_id
		 WHERE dp.user_id = $1 AND dp.date = $2
		 ORDER BY dpi.position`,
		userID, date)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var tasks []TodayTask
	for rows.Next() {
		var tt TodayTask
		var deadline *time.Time
		if err := rows.Scan(&tt.ID, &tt.Title, &tt.TopicTitle, &deadline,
			&tt.Status, &tt.IsCompleted, &tt.Position); err != nil {
			return nil, apperr.E(op, err)
		}
		if deadline != nil {
			s := deadline.Format("2006-01-02")
			tt.Deadline = &s
		}
		tasks = append(tasks, tt)
	}
	return tasks, apperr.E(op, rows.Err())
}

func (r *Repo) GetCurrentMaterial(ctx context.Context, userID string) (*TodayMaterial, error) {
	const op apperr.Op = "today.Repo.GetCurrentMaterial"

	var mat TodayMaterial
	err := r.pool.QueryRow(ctx,
		`SELECT m.id, m.title, top.title AS topic_title, m.type,
		        m.completed_amount, m.total_amount,
		        CASE WHEN m.total_amount > 0
		             THEN (m.completed_amount * 100 / m.total_amount)
		             ELSE 0
		        END AS progress_percent
		 FROM materials m
		 JOIN topics top ON top.id = m.topic_id AND top.user_id = m.user_id
		 WHERE m.user_id = $1
		   AND m.completed_amount < m.total_amount
		 ORDER BY m.updated_at DESC
		 LIMIT 1`,
		userID).Scan(
		&mat.ID, &mat.Title, &mat.TopicTitle, &mat.Type,
		&mat.CompletedAmount, &mat.TotalAmount, &mat.ProgressPercent)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, apperr.E(op, err)
	}
	return &mat, nil
}

func (r *Repo) GetPlanItemCount(ctx context.Context, planID string) (int, error) {
	const op apperr.Op = "today.Repo.GetPlanItemCount"

	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM daily_plan_items WHERE daily_plan_id = $1`,
		planID).Scan(&count)
	if err != nil {
		return 0, apperr.E(op, err)
	}
	return count, nil
}

func (r *Repo) UpdateTaskStatus(ctx context.Context, taskID, status string) error {
	const op apperr.Op = "today.Repo.UpdateTaskStatus"

	_, err := r.pool.Exec(ctx,
		`UPDATE tasks SET status = $2, updated_at = now() WHERE id = $1`,
		taskID, status)
	return apperr.E(op, err)
}

func (r *Repo) GetFocusTaskIDs(ctx context.Context, userID string) ([]string, error) {
	const op apperr.Op = "today.Repo.GetFocusTaskIDs"

	rows, err := r.pool.Query(ctx,
		`SELECT t.id
		 FROM tasks t
		 LEFT JOIN topics top ON top.id = t.topic_id AND top.user_id = t.user_id
		 WHERE t.user_id = $1
		   AND t.status != 'done'
		   AND (
		     (t.deadline IS NOT NULL AND t.deadline <= CURRENT_DATE)
		     OR t.status = 'in_progress'
		     OR (t.topic_id IS NOT NULL AND top.status = 'in_progress')
		   )
		 ORDER BY
		   CASE
		     WHEN t.deadline < CURRENT_DATE AND t.status != 'done' THEN 1
		     WHEN t.deadline = CURRENT_DATE AND t.status != 'done' THEN 2
		     WHEN t.status = 'in_progress' THEN 3
		     ELSE 4
		   END ASC,
		   top.target_date ASC NULLS LAST,
		   t.created_at ASC
		 LIMIT 3`,
		userID)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, apperr.E(op, err)
		}
		ids = append(ids, id)
	}
	return ids, apperr.E(op, rows.Err())
}
