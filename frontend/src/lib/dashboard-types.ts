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

export interface DashboardBlockedTopic {
  id: string;
  title: string;
  blockedReason: string;
}

export interface DashboardRecentMaterial {
  id: string;
  title: string;
  topicTitle: string;
  progressPercent: number;
  lastOpenedAt: string;
}

export interface DashboardDailySummary {
  nextTaskTitle: string | null;
  blockedTopicsCount: number;
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

export interface DashboardTopicAccessChart {
  blocked: number;
  available: number;
}

export interface DashboardChartsPayload {
  topicsByStatus: DashboardTopicsByStatusChart;
  upcomingDeadlines: DashboardDeadlinesByDayChartItem[];
  topicAccess: DashboardTopicAccessChart;
}
