import { NextRequest } from "next/server";
import {
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
      // Graceful fallback: return empty summary instead of error for new users
      return dashboardJson(client, {
        nextTaskTitle: null,
        upcomingTasksCount: 0
      });
    }

    const tasksResult = await loadTasks(client);
    if (tasksResult.errorResponse) {
      // Graceful fallback: return empty summary instead of error
      return dashboardJson(client, {
        nextTaskTitle: null,
        upcomingTasksCount: 0
      });
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
