export interface DashboardProgress {
  roadmapProgressPercent: number;
  completedTopics: number;
  totalTopics: number;
  focusHoursCompleted: number;
  focusHoursTarget: number;
}

export interface DashboardTopicInProgress {
  id: string;
  title: string;
  progressPercent: number;
  targetDate: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  topicTitle?: string;
  dueAt: string;
}

export interface DashboardRecentMaterial {
  id: string;
  title: string;
  topicTitle: string;
  progressPercent: number;
  lastOpenedAt: string;
}

export interface DashboardHistoryEvent {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  eventName: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardDailySummary {
  nextTaskTitle: string | null;
  upcomingTasksCount: number;
}

export interface DashboardTopicsByStatusChart {
  notStarted: number;
  inProgress: number;
  paused: number;
  completed: number;
}

export interface DashboardDeadlinesByDayChartItem {
  date: string;
  count: number;
}

export interface DashboardChartsPayload {
  topicsByStatus: DashboardTopicsByStatusChart;
  upcomingDeadlines: DashboardDeadlinesByDayChartItem[];
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface ActivityHeatmap {
  days: ActivityDay[];
  streak: number;
  totalActiveDays: number;
}

export interface DashboardFocusTask {
  id: string;
  title: string;
  topicId: string | null;
  topicTitle: string | null;
  status: string;
  deadline: string | null;
  priorityLevel: "overdue" | "due_today" | "in_progress" | "active_topic";
}

export interface DashboardFocusTopic {
  id: string;
  title: string;
  lastTaskTitle: string;
  progressPercent: number;
}

export interface DashboardFocus {
  primaryTask: DashboardFocusTask | null;
  secondaryTasks: DashboardFocusTask[];
  continueTopic: DashboardFocusTopic | null;
}
