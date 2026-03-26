import { NextRequest } from "next/server";
import {
  applyDashboardError,
  createDashboardClient,
  dashboardJson,
  dashboardUnavailableResponse,
  loadRoadmapOrEmpty,
  loadTasks
} from "../_shared";

function parseDeadline(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getTime();
}

export async function GET(request: NextRequest) {
  const client = createDashboardClient(request);

  try {
    const roadmapResult = await loadRoadmapOrEmpty(client);
    if (roadmapResult.errorResponse) {
      return applyDashboardError(client, roadmapResult.errorResponse);
    }

    const tasksResult = await loadTasks(client);
    if (tasksResult.errorResponse) {
      return applyDashboardError(client, tasksResult.errorResponse);
    }

    const now = Date.now();
    const upcomingTasks = (tasksResult.tasks ?? [])
      .filter((task) => task.status !== "done")
      .map((task) => ({
        task,
        timestamp: parseDeadline(task.deadline)
      }))
      .filter((entry) => entry.timestamp !== null && entry.timestamp >= now)
      .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));

    const upcomingTasksCount = upcomingTasks.length;
    const nextTaskTitle = upcomingTasks[0]?.task.title ?? null;

    return dashboardJson(client, {
      nextTaskTitle,
      upcomingTasksCount
    });
  } catch {
    return dashboardUnavailableResponse();
  }
}
