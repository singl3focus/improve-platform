import { NextRequest } from "next/server";
import {
  applyDashboardError,
  createDashboardClient,
  dashboardJson,
  dashboardUnavailableResponse,
  flattenRoadmapTopics,
  loadRoadmapOrEmpty,
  loadTasks
} from "../_shared";

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

    const topics = flattenRoadmapTopics(roadmapResult.roadmap);
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 6);
    dayEnd.setHours(23, 59, 59, 999);

    const deadlinesByDay = new Map<string, number>();
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(dayStart);
      day.setDate(day.getDate() + offset);
      deadlinesByDay.set(toDayKey(day), 0);
    }

    for (const task of tasksResult.tasks ?? []) {
      if (task.status === "done" || !task.deadline) {
        continue;
      }

      const deadline = new Date(task.deadline);
      if (Number.isNaN(deadline.getTime()) || deadline < dayStart || deadline > dayEnd) {
        continue;
      }

      const key = toDayKey(deadline);
      deadlinesByDay.set(key, (deadlinesByDay.get(key) ?? 0) + 1);
    }

    return dashboardJson(client, {
      topicsByStatus: {
        notStarted: topics.filter((topic) => topic.status === "not_started").length,
        inProgress: topics.filter((topic) => topic.status === "in_progress").length,
        paused: topics.filter((topic) => topic.status === "paused").length,
        completed: topics.filter((topic) => topic.status === "completed").length
      },
      upcomingDeadlines: Array.from(deadlinesByDay.entries()).map(([date, count]) => ({
        date,
        count
      })),
      topicAccess: {
        blocked: topics.filter((topic) => topic.is_blocked).length,
        available: topics.filter((topic) => !topic.is_blocked).length
      }
    });
  } catch {
    return dashboardUnavailableResponse();
  }
}
