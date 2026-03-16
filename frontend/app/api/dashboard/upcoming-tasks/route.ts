import { NextRequest } from "next/server";
import {
  applyDashboardError,
  buildTopicTitleMap,
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

    const topicTitleMap = buildTopicTitleMap(roadmapResult.roadmap);
    const now = Date.now();

    const payload = (tasksResult.tasks ?? [])
      .filter((task) => task.status !== "done")
      .map((task) => ({
        task,
        timestamp: parseDeadline(task.deadline)
      }))
      .filter((entry) => entry.timestamp !== null && entry.timestamp >= now)
      .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))
      .map(({ task }) => ({
        id: task.id,
        title: task.title,
        topicTitle: task.topic_id ? (topicTitleMap.get(task.topic_id) ?? undefined) : undefined,
        dueAt: task.deadline ?? ""
      }));

    return dashboardJson(client, payload);
  } catch {
    return dashboardUnavailableResponse();
  }
}

