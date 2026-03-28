export interface WeeklyReviewTask {
  id: string;
  title: string;
  topicTitle: string | null;
  deadline: string | null;
  status: string;
}

export interface WeeklyReviewTopic {
  id: string;
  title: string;
  status: string;
  progressPercent: number;
  targetDate: string | null;
}

export interface WeeklyReviewData {
  periodStart: string;
  periodEnd: string;
  completedTasks: WeeklyReviewTask[];
  completedTopics: WeeklyReviewTopic[];
  stuckTasks: WeeklyReviewTask[];
  stuckTopics: WeeklyReviewTopic[];
  upcomingTasks: WeeklyReviewTask[];
  activeTopics: WeeklyReviewTopic[];
  progressBefore: number;
  progressNow: number;
}
