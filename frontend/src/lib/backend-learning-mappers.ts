import type { TaskBoardStatus } from "@/lib/tasks-board-types";
import type { TopicChecklistStatus } from "@/lib/topic-workspace-types";
import type { BackendTaskResponse } from "@/lib/backend-learning-contracts";

export function mapBackendTaskStatusToBoard(status: BackendTaskResponse["status"]): TaskBoardStatus {
  if (status === "done") {
    return "completed";
  }
  return status;
}

export function mapBoardTaskStatusToBackend(status: TaskBoardStatus): BackendTaskResponse["status"] {
  if (status === "completed") {
    return "done";
  }
  return status;
}

export function mapBackendTaskStatusToChecklist(
  status: BackendTaskResponse["status"]
): TopicChecklistStatus {
  if (status === "done") {
    return "done";
  }
  if (status === "in_progress") {
    return "in_progress";
  }
  return "todo";
}

export function mapChecklistStatusToBackend(status: TopicChecklistStatus): BackendTaskResponse["status"] {
  if (status === "done") {
    return "done";
  }
  if (status === "in_progress") {
    return "in_progress";
  }
  return "new";
}

export function isTaskDueWithinWeek(deadline: string | null): boolean {
  if (!deadline) {
    return false;
  }

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return date.getTime() >= now && date.getTime() <= now + sevenDaysMs;
}

export function isTaskOverdue(task: Pick<BackendTaskResponse, "status" | "deadline" | "is_overdue">): boolean {
  if (task.status === "done") {
    return false;
  }

  if (task.is_overdue) {
    return true;
  }

  if (!task.deadline) {
    return false;
  }

  const date = new Date(task.deadline);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() < Date.now();
}

