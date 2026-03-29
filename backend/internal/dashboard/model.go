package dashboard

type FocusTask struct {
	ID            string  `json:"id"`
	Title         string  `json:"title"`
	TopicID       *string `json:"topic_id"`
	TopicTitle    *string `json:"topic_title"`
	Status        string  `json:"status"`
	Deadline      *string `json:"deadline"`
	PriorityLevel string  `json:"priority_level"`
}

type FocusTopic struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	LastTaskTitle   string `json:"last_task_title"`
	ProgressPercent int    `json:"progress_percent"`
}

type FocusResponse struct {
	PrimaryTask    *FocusTask  `json:"primary_task"`
	SecondaryTasks []FocusTask `json:"secondary_tasks"`
	ContinueTopic  *FocusTopic `json:"continue_topic"`
}

type WeeklyReviewData struct {
	PeriodStart     string        `json:"period_start"`
	PeriodEnd       string        `json:"period_end"`
	CompletedTasks  []ReviewTask  `json:"completed_tasks"`
	CompletedTopics []ReviewTopic `json:"completed_topics"`
	StuckTasks      []ReviewTask  `json:"stuck_tasks"`
	StuckTopics     []ReviewTopic `json:"stuck_topics"`
	UpcomingTasks   []ReviewTask  `json:"upcoming_tasks"`
	ActiveTopics    []ReviewTopic `json:"active_topics"`
	ProgressBefore  int           `json:"progress_before"`
	ProgressNow     int           `json:"progress_now"`
}

type ReviewTask struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	TopicTitle *string `json:"topic_title"`
	Deadline   *string `json:"deadline"`
	Status     string  `json:"status"`
}

type ReviewTopic struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	Status          string  `json:"status"`
	ProgressPercent int     `json:"progress_percent"`
	TargetDate      *string `json:"target_date"`
}

type ActivityDay struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type ActivityHeatmap struct {
	Days            []ActivityDay `json:"days"`
	Streak          int           `json:"streak"`
	TotalActiveDays int           `json:"total_active_days"`
}

type SaveWeeklyReviewRequest struct {
	PeriodStart     string `json:"period_start"`
	PeriodEnd       string `json:"period_end"`
	ReflectionNote  string `json:"reflection_note"`
	NextWeekGoal    string `json:"next_week_goal"`
	CompletedTasks  int    `json:"completed_tasks_count"`
	CompletedTopics int    `json:"completed_topics_count"`
}
