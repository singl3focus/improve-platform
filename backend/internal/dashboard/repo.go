package dashboard

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	apperr "improve-platform/pkg/errors"
)

type Repo struct {
	pool *pgxpool.Pool
}

func NewRepo(pool *pgxpool.Pool) *Repo {
	return &Repo{pool: pool}
}

func (r *Repo) GetFocusTasks(ctx context.Context, userID string) ([]FocusTask, error) {
	const op apperr.Op = "dashboard.Repo.GetFocusTasks"
	rows, err := r.pool.Query(ctx,
		`SELECT
			t.id, t.title, t.topic_id, top.title AS topic_title,
			t.status, t.deadline,
			CASE
				WHEN t.deadline < CURRENT_DATE AND t.status != 'done' THEN 'overdue'
				WHEN t.deadline = CURRENT_DATE AND t.status != 'done' THEN 'due_today'
				WHEN t.status = 'in_progress' THEN 'in_progress'
				ELSE 'active_topic'
			END AS priority_level
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
		LIMIT 10`,
		userID,
	)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var tasks []FocusTask
	for rows.Next() {
		var ft FocusTask
		var deadline *time.Time
		if err := rows.Scan(&ft.ID, &ft.Title, &ft.TopicID, &ft.TopicTitle,
			&ft.Status, &deadline, &ft.PriorityLevel); err != nil {
			return nil, apperr.E(op, err)
		}
		if deadline != nil {
			s := deadline.Format("2006-01-02")
			ft.Deadline = &s
		}
		tasks = append(tasks, ft)
	}
	return tasks, apperr.E(op, rows.Err())
}

func (r *Repo) GetContinueTopic(ctx context.Context, userID string) (*FocusTopic, error) {
	var ft FocusTopic
	var lastTaskTitle *string
	err := r.pool.QueryRow(ctx,
		`SELECT
			top.id, top.title,
			last_task.title AS last_task_title,
			COALESCE(
				(COUNT(*) FILTER (WHERE tk.status = 'done') * 100 / NULLIF(COUNT(tk.id), 0)),
				0
			)::int AS progress_percent
		FROM history_events he
		JOIN tasks last_task ON last_task.id = he.entity_id AND last_task.user_id = he.user_id
		JOIN topics top ON top.id = last_task.topic_id AND top.user_id = he.user_id
		LEFT JOIN tasks tk ON tk.topic_id = top.id AND tk.user_id = he.user_id
		WHERE he.user_id = $1
		  AND he.entity_type = 'task'
		  AND last_task.topic_id IS NOT NULL
		  AND top.status = 'in_progress'
		GROUP BY top.id, top.title, last_task.title, he.created_at
		ORDER BY he.created_at DESC
		LIMIT 1`,
		userID,
	).Scan(&ft.ID, &ft.Title, &lastTaskTitle, &ft.ProgressPercent)
	if err != nil {
		return nil, nil // no continue topic is fine
	}
	if lastTaskTitle != nil {
		ft.LastTaskTitle = *lastTaskTitle
	}
	return &ft, nil
}

func (r *Repo) GetActivityHeatmap(ctx context.Context, userID string, from, to time.Time) ([]ActivityDay, error) {
	const op apperr.Op = "dashboard.Repo.GetActivityHeatmap"

	rows, err := r.pool.Query(ctx,
		`SELECT date_trunc('day', created_at)::date AS date, COUNT(*) AS count
		 FROM history_events
		 WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
		 GROUP BY date
		 ORDER BY date`,
		userID, from, to)
	if err != nil {
		return nil, apperr.E(op, err)
	}
	defer rows.Close()

	var days []ActivityDay
	for rows.Next() {
		var d ActivityDay
		var dt time.Time
		if err := rows.Scan(&dt, &d.Count); err != nil {
			return nil, apperr.E(op, err)
		}
		d.Date = dt.Format("2006-01-02")
		days = append(days, d)
	}
	return days, apperr.E(op, rows.Err())
}

func (r *Repo) GetCurrentStreak(ctx context.Context, userID string) (int, error) {
	const op apperr.Op = "dashboard.Repo.GetCurrentStreak"

	var streak int
	err := r.pool.QueryRow(ctx,
		`WITH daily AS (
			SELECT DISTINCT date_trunc('day', created_at)::date AS d
			FROM history_events WHERE user_id = $1
		), numbered AS (
			SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d DESC))::int AS grp
			FROM daily WHERE d <= CURRENT_DATE
		)
		SELECT COUNT(*)::int FROM numbered
		WHERE grp = (SELECT grp FROM numbered WHERE d = CURRENT_DATE LIMIT 1)`,
		userID).Scan(&streak)
	if err != nil {
		return 0, nil // no streak is fine
	}
	return streak, nil
}

func (r *Repo) GetWeeklyReviewData(ctx context.Context, userID string) (WeeklyReviewData, error) {
	const op apperr.Op = "dashboard.Repo.GetWeeklyReviewData"
	now := time.Now()
	periodEnd := now.Format("2006-01-02")
	periodStart := now.AddDate(0, 0, -7).Format("2006-01-02")

	data := WeeklyReviewData{
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
		CompletedTasks:  []ReviewTask{},
		CompletedTopics: []ReviewTopic{},
		StuckTasks:      []ReviewTask{},
		StuckTopics:     []ReviewTopic{},
		UpcomingTasks:   []ReviewTask{},
		ActiveTopics:    []ReviewTopic{},
	}

	// Completed tasks (done in last 7 days)
	rows, err := r.pool.Query(ctx,
		`SELECT t.id, t.title, top.title, t.deadline, t.status
		 FROM tasks t
		 LEFT JOIN topics top ON top.id = t.topic_id AND top.user_id = t.user_id
		 WHERE t.user_id = $1 AND t.status = 'done' AND t.updated_at >= NOW() - INTERVAL '7 days'
		 ORDER BY t.updated_at DESC`,
		userID)
	if err != nil {
		return data, apperr.E(op, err)
	}
	defer rows.Close()
	for rows.Next() {
		var rt ReviewTask
		var deadline *time.Time
		if err := rows.Scan(&rt.ID, &rt.Title, &rt.TopicTitle, &deadline, &rt.Status); err != nil {
			return data, apperr.E(op, err)
		}
		if deadline != nil {
			s := deadline.Format("2006-01-02")
			rt.Deadline = &s
		}
		data.CompletedTasks = append(data.CompletedTasks, rt)
	}

	// Completed topics (last 7 days)
	rows2, err := r.pool.Query(ctx,
		`SELECT t.id, t.title, t.status,
		        COALESCE((SELECT COUNT(*) FILTER (WHERE tk.status='done')*100/NULLIF(COUNT(*),0) FROM tasks tk WHERE tk.topic_id=t.id AND tk.user_id=t.user_id), 0)::int,
		        t.target_date
		 FROM topics t
		 WHERE t.user_id = $1 AND t.status = 'completed' AND t.completed_date >= CURRENT_DATE - 7
		 ORDER BY t.completed_date DESC`,
		userID)
	if err != nil {
		return data, apperr.E(op, err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var rt ReviewTopic
		var targetDate *time.Time
		if err := rows2.Scan(&rt.ID, &rt.Title, &rt.Status, &rt.ProgressPercent, &targetDate); err != nil {
			return data, apperr.E(op, err)
		}
		if targetDate != nil {
			s := targetDate.Format("2006-01-02")
			rt.TargetDate = &s
		}
		data.CompletedTopics = append(data.CompletedTopics, rt)
	}

	// Stuck tasks (overdue, not done)
	rows3, err := r.pool.Query(ctx,
		`SELECT t.id, t.title, top.title, t.deadline, t.status
		 FROM tasks t
		 LEFT JOIN topics top ON top.id = t.topic_id AND top.user_id = t.user_id
		 WHERE t.user_id = $1 AND t.status != 'done' AND t.deadline < CURRENT_DATE
		 ORDER BY t.deadline ASC`,
		userID)
	if err != nil {
		return data, apperr.E(op, err)
	}
	defer rows3.Close()
	for rows3.Next() {
		var rt ReviewTask
		var deadline *time.Time
		if err := rows3.Scan(&rt.ID, &rt.Title, &rt.TopicTitle, &deadline, &rt.Status); err != nil {
			return data, apperr.E(op, err)
		}
		if deadline != nil {
			s := deadline.Format("2006-01-02")
			rt.Deadline = &s
		}
		data.StuckTasks = append(data.StuckTasks, rt)
	}

	// Stuck topics (in_progress, target_date in past)
	rows4, err := r.pool.Query(ctx,
		`SELECT t.id, t.title, t.status,
		        COALESCE((SELECT COUNT(*) FILTER (WHERE tk.status='done')*100/NULLIF(COUNT(*),0) FROM tasks tk WHERE tk.topic_id=t.id AND tk.user_id=t.user_id), 0)::int,
		        t.target_date
		 FROM topics t
		 WHERE t.user_id = $1 AND t.status = 'in_progress' AND t.target_date < CURRENT_DATE
		 ORDER BY t.target_date ASC`,
		userID)
	if err != nil {
		return data, apperr.E(op, err)
	}
	defer rows4.Close()
	for rows4.Next() {
		var rt ReviewTopic
		var targetDate *time.Time
		if err := rows4.Scan(&rt.ID, &rt.Title, &rt.Status, &rt.ProgressPercent, &targetDate); err != nil {
			return data, apperr.E(op, err)
		}
		if targetDate != nil {
			s := targetDate.Format("2006-01-02")
			rt.TargetDate = &s
		}
		data.StuckTopics = append(data.StuckTopics, rt)
	}

	// Upcoming tasks (next 7 days)
	rows5, err := r.pool.Query(ctx,
		`SELECT t.id, t.title, top.title, t.deadline, t.status
		 FROM tasks t
		 LEFT JOIN topics top ON top.id = t.topic_id AND top.user_id = t.user_id
		 WHERE t.user_id = $1 AND t.status != 'done' AND t.deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
		 ORDER BY t.deadline ASC`,
		userID)
	if err != nil {
		return data, apperr.E(op, err)
	}
	defer rows5.Close()
	for rows5.Next() {
		var rt ReviewTask
		var deadline *time.Time
		if err := rows5.Scan(&rt.ID, &rt.Title, &rt.TopicTitle, &deadline, &rt.Status); err != nil {
			return data, apperr.E(op, err)
		}
		if deadline != nil {
			s := deadline.Format("2006-01-02")
			rt.Deadline = &s
		}
		data.UpcomingTasks = append(data.UpcomingTasks, rt)
	}

	// Active topics
	rows6, err := r.pool.Query(ctx,
		`SELECT t.id, t.title, t.status,
		        COALESCE((SELECT COUNT(*) FILTER (WHERE tk.status='done')*100/NULLIF(COUNT(*),0) FROM tasks tk WHERE tk.topic_id=t.id AND tk.user_id=t.user_id), 0)::int,
		        t.target_date
		 FROM topics t
		 WHERE t.user_id = $1 AND t.status = 'in_progress'
		 ORDER BY t.target_date ASC NULLS LAST`,
		userID)
	if err != nil {
		return data, apperr.E(op, err)
	}
	defer rows6.Close()
	for rows6.Next() {
		var rt ReviewTopic
		var targetDate *time.Time
		if err := rows6.Scan(&rt.ID, &rt.Title, &rt.Status, &rt.ProgressPercent, &targetDate); err != nil {
			return data, apperr.E(op, err)
		}
		if targetDate != nil {
			s := targetDate.Format("2006-01-02")
			rt.TargetDate = &s
		}
		data.ActiveTopics = append(data.ActiveTopics, rt)
	}

	// Progress now (% of completed topics)
	err = r.pool.QueryRow(ctx,
		`SELECT
		  COALESCE(COUNT(*) FILTER (WHERE status = 'completed') * 100 / NULLIF(COUNT(*), 0), 0)::int
		 FROM topics WHERE user_id = $1`,
		userID).Scan(&data.ProgressNow)
	if err != nil {
		return data, apperr.E(op, err)
	}

	// Approximate progress 7 days ago using history events
	data.ProgressBefore = data.ProgressNow
	var completedThisWeek int
	var totalTopics int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM topics WHERE user_id = $1`, userID).Scan(&totalTopics); err != nil {
		return data, apperr.E(op, err)
	}
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM topics
		 WHERE user_id = $1 AND status = 'completed' AND completed_date >= CURRENT_DATE - 7`,
		userID).Scan(&completedThisWeek); err != nil {
		return data, apperr.E(op, err)
	}
	if totalTopics > 0 {
		completedBefore := (data.ProgressNow * totalTopics / 100) - completedThisWeek
		if completedBefore < 0 {
			completedBefore = 0
		}
		data.ProgressBefore = completedBefore * 100 / totalTopics
	}

	return data, nil
}
