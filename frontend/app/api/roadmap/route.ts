import { NextRequest, NextResponse } from "next/server";
import type { RoadmapResponse, RoadmapTopic } from "@/lib/roadmap-types";
import type {
  BackendRoadmapResponse,
  BackendRoadmapTopic,
  BackendTopicTasksResponse
} from "@/lib/backend-learning-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@/lib/backend-api";

interface TopicMetrics {
  tasksCount: number;
  progressPercent: number;
  materialsCount: number;
}

interface BackendFlatRoadmapTopic {
  id: string;
  title: string;
  description: string;
  position: number;
  status: BackendRoadmapTopic["status"];
  is_blocked: boolean;
  block_reasons: string[];
  dependencies: string[];
  stage_id?: string;
}

interface BackendFlatRoadmapResponse {
  id: string;
  title: string;
  topics: BackendFlatRoadmapTopic[];
}

function getBlockedReason(topic: { block_reasons?: string[] }): string | null {
  if (!Array.isArray(topic.block_reasons) || topic.block_reasons.length === 0) {
    return null;
  }

  return topic.block_reasons.join(". ");
}

async function loadTopicMetrics(
  client: ReturnType<typeof createBackendClient>,
  topicId: string
): Promise<{ metrics: TopicMetrics | null; errorResponse: NextResponse | null }> {
  const tasksResult = await client.call(`/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/tasks`, {
    method: "GET"
  });

  if (!tasksResult.response.ok) {
    if (tasksResult.response.status !== 404 || !isBackendErrorCode(tasksResult.payload, "topic_not_found")) {
      return {
        metrics: null,
        errorResponse: createBackendErrorResponse(
          tasksResult.response,
          tasksResult.payload,
          "Failed to load topic tasks."
        )
      };
    }
  }

  const materialsResult = await client.call(
    `/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/materials`,
    {
      method: "GET"
    }
  );

  if (!materialsResult.response.ok) {
    if (
      materialsResult.response.status !== 404 ||
      !isBackendErrorCode(materialsResult.payload, "topic_not_found")
    ) {
      return {
        metrics: null,
        errorResponse: createBackendErrorResponse(
          materialsResult.response,
          materialsResult.payload,
          "Failed to load topic materials."
        )
      };
    }
  }

  const tasksPayload = tasksResult.response.ok
    ? (tasksResult.payload as BackendTopicTasksResponse)
    : null;
  const materialsPayload = materialsResult.response.ok
    ? (materialsResult.payload as Array<unknown>)
    : null;

  return {
    metrics: {
      tasksCount: tasksPayload?.total ?? 0,
      progressPercent: tasksPayload?.percent ?? 0,
      materialsCount: Array.isArray(materialsPayload) ? materialsPayload.length : 0
    },
    errorResponse: null
  };
}

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);

  try {
    const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });

    if (!roadmapResult.response.ok) {
      if (
        roadmapResult.response.status === 404 &&
        isBackendErrorCode(roadmapResult.payload, "roadmap_not_found")
      ) {
        const response = NextResponse.json({ stages: [] } satisfies RoadmapResponse, {
          status: 200
        });
        client.applyUpdatedSession(response);
        return response;
      }

      const errorResponse = createBackendErrorResponse(
        roadmapResult.response,
        roadmapResult.payload,
        "Roadmap request failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const roadmapPayload = roadmapResult.payload as BackendRoadmapResponse | BackendFlatRoadmapResponse;
    const mappedStages: RoadmapResponse["stages"] = [];

    const hasStageGroups = Array.isArray((roadmapPayload as BackendRoadmapResponse).stages);
    const normalizedStages = hasStageGroups
      ? (roadmapPayload as BackendRoadmapResponse).stages
      : [
          {
            id: (roadmapPayload as BackendFlatRoadmapResponse).id,
            title: (roadmapPayload as BackendFlatRoadmapResponse).title,
            position: 1,
            topics: Array.isArray((roadmapPayload as BackendFlatRoadmapResponse).topics)
              ? [...(roadmapPayload as BackendFlatRoadmapResponse).topics].sort(
                  (left, right) => left.position - right.position
                )
              : []
          }
        ];

    for (const stage of normalizedStages) {
      const mappedTopics: RoadmapTopic[] = [];

      for (const [topicIndex, topic] of (stage.topics ?? []).entries()) {
        const metricsResult = await loadTopicMetrics(client, topic.id);
        if (metricsResult.errorResponse) {
          client.applyUpdatedSession(metricsResult.errorResponse);
          return metricsResult.errorResponse;
        }

        mappedTopics.push({
          id: topic.id,
          stageId: topic.stage_id ?? stage.id,
          title: topic.title,
          description: topic.description,
          position:
            typeof topic.position === "number" && Number.isFinite(topic.position)
              ? topic.position
              : topicIndex + 1,
          status: topic.status,
          progressPercent: metricsResult.metrics?.progressPercent ?? 0,
          isBlocked: topic.is_blocked,
          blockedReason: getBlockedReason(topic),
          tasksCount: metricsResult.metrics?.tasksCount ?? 0,
          materialsCount: metricsResult.metrics?.materialsCount ?? 0,
          prerequisiteTopicIds: Array.isArray(topic.dependencies) ? topic.dependencies : []
        });
      }

      mappedStages.push({
        id: stage.id,
        title: stage.title,
        topics: mappedTopics
      });
    }

    const response = NextResponse.json({ stages: mappedStages } satisfies RoadmapResponse, {
      status: 200
    });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
