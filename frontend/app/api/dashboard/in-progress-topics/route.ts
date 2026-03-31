import { NextRequest, NextResponse } from "next/server";
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
import { mapWithConcurrency } from "@shared/lib/map-with-concurrency";

const IN_PROGRESS_TOPICS_CONCURRENCY = 6;
const IN_PROGRESS_TOPIC_TIMEOUT_MS = 8_000;

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

    const payload = await mapWithConcurrency(
      inProgressTopics,
      async (topic) => {
        const tasksResult = await client.call(
          `/api/v1/roadmap/topics/${encodeURIComponent(topic.id)}/tasks`,
          {
            method: "GET",
            signal: request.signal,
            timeoutMs: IN_PROGRESS_TOPIC_TIMEOUT_MS
          }
        );

        if (!tasksResult.response.ok) {
          if (
            tasksResult.response.status === 404 &&
            isBackendErrorCode(tasksResult.payload, "topic_not_found")
          ) {
            return {
              item: {
                id: topic.id,
                title: topic.title,
                progressPercent: 0,
                targetDate: topic.target_date ?? ""
              },
              errorResponse: null as NextResponse | null
            };
          }

          return {
            item: null as {
              id: string;
              title: string;
              progressPercent: number;
              targetDate: string;
            } | null,
            errorResponse: createBackendErrorResponse(
              tasksResult.response,
              tasksResult.payload,
              "Failed to load in-progress topics."
            )
          };
        }

        const tasksPayload = tasksResult.payload as BackendTopicTasksResponse;
        return {
          item: {
            id: topic.id,
            title: topic.title,
            progressPercent: tasksPayload.percent ?? 0,
            targetDate: topic.target_date ?? ""
          },
          errorResponse: null as NextResponse | null
        };
      },
      {
        concurrency: IN_PROGRESS_TOPICS_CONCURRENCY,
        signal: request.signal
      }
    );

    const failedItem = payload.find((entry) => entry.errorResponse);
    if (failedItem?.errorResponse) {
      return applyDashboardError(client, failedItem.errorResponse);
    }

    return dashboardJson(
      client,
      payload.flatMap((entry) => (entry.item ? [entry.item] : []))
    );
  } catch (error) {
    return dashboardUnavailableResponse();
  }
}
