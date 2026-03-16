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
    const totalTopics = topics.length;
    const completedTopics = topics.filter((topic) => topic.status === "completed").length;
    const roadmapProgressPercent =
      totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    const tasks = tasksResult.tasks ?? [];
    const focusHoursCompleted = tasks.filter((task) => task.status === "done").length;
    const focusHoursTarget = tasks.length;

    return dashboardJson(client, {
      roadmapProgressPercent,
      completedTopics,
      totalTopics,
      focusHoursCompleted,
      focusHoursTarget
    });
  } catch {
    return dashboardUnavailableResponse();
  }
}

