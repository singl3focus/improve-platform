export type TaskBoardStatus = "new" | "in_progress" | "paused" | "completed";

export type TaskBoardDueFilter = "all" | "overdue" | "week";

export interface TaskBoardItem {
  id: string;
  title: string;
  description: string;
  topicId: string | null;
  topicTitle: string | null;
  dueAt: string;
  status: TaskBoardStatus;
}
