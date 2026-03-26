import { NextRequest } from "next/server";
import type { BackendTopicTasksResponse } from "@shared/api/backend-contracts";
import {
  applyDashboardError,
  createDashboardClient,
  dashboardJson,
  dashboardUnavailableResponse,
  flattenRoadmapTopics,
  loadRoadmapOrEmpty
} from "../_shared";
import { createBackendErrorResponse, isBackendErrorCode } from "@shared/api/backend-client";

export async function GET(request: NextRequest) {
  const client = createDashboardClient(request);

  try {
    const roadmapResult = await loadRoadmapOrEmpty(client);
    if (roadmapResult.errorResponse) {
      return applyDashboardError(client, roadmapResult.errorResponse);
    }

    const inProgressTopics = flattenRoadmapTopics(roadmapResult.roadmap).filter(
      (topic) => topic.status === "in_progress"
    );

    const payload: Array<{
      id: string;
      title: string;
      progressPercent: number;
      targetDate: string;
    }> = [];

    for (const topic of inProgressTopics) {
      const tasksResult = await client.call(
        `/api/v1/roadmap/topics/${encodeURIComponent(topic.id)}/tasks`,
        {
          method: "GET"
        }
      );

      if (!tasksResult.response.ok) {
        if (
          tasksResult.response.status === 404 &&
          isBackendErrorCode(tasksResult.payload, "topic_not_found")
        ) {
          payload.push({
            id: topic.id,
            title: topic.title,
            progressPercent: 0,
            targetDate: topic.target_date ?? ""
          });
          continue;
        }

        return applyDashboardError(
          client,
          createBackendErrorResponse(
            tasksResult.response,
            tasksResult.payload,
            "Failed to load in-progress topics."
          )
        );
      }

      const tasksPayload = tasksResult.payload as BackendTopicTasksResponse;
      payload.push({
        id: topic.id,
        title: topic.title,
        progressPercent: tasksPayload.percent ?? 0,
        targetDate: topic.target_date ?? ""
      });
    }

    return dashboardJson(client, payload);
  } catch {
    return dashboardUnavailableResponse();
  }
}

