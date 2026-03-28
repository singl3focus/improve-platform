import { NextRequest, NextResponse } from "next/server";
import type { RoadmapResponse, RoadmapTopic } from "@features/roadmap/types";
import type {
  BackendRoadmapTopic
} from "@shared/api/backend-contracts";
import { isBackendRoadmapResponse, isBackendTopicTasksResponse } from "@shared/api/backend-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@shared/api/backend-client";

interface RouteContext {
  params: {
    roadmapId: string;
  };
}

interface TopicMetrics {
  tasksCount: number;
  progressPercent: number;
  materialsCount: number;
}

interface BackendFlatRoadmapTopic {
  id: string;
  title: string;
  description: string;
  goal?: string;
  position: number;
  status: BackendRoadmapTopic["status"];
  confidence?: number | null;
  dependencies: string[];
  stage_id?: string;
}

interface BackendFlatRoadmapResponse {
  id: string;
  title: string;
  topics: BackendFlatRoadmapTopic[];
}

function canSkipTopicMetricsError(status: number): boolean {
  return status >= 500;
}

async function loadTopicMetrics(
  client: ReturnType<typeof createBackendClient>,
  roadmapId: string,
  topicId: string
): Promise<{ metrics: TopicMetrics | null; errorResponse: NextResponse | null }> {
  const tasksResult = await client.call(
    `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}/tasks`,
    { method: "GET" }
  );

  if (!tasksResult.response.ok) {
    const topicNotFound =
      tasksResult.response.status === 404 &&
      isBackendErrorCode(tasksResult.payload, "topic_not_found");

    if (!topicNotFound && !canSkipTopicMetricsError(tasksResult.response.status)) {
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
    `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}/materials`,
    { method: "GET" }
  );

  if (!materialsResult.response.ok) {
    const topicNotFound =
      materialsResult.response.status === 404 &&
      isBackendErrorCode(materialsResult.payload, "topic_not_found");

    if (!topicNotFound && !canSkipTopicMetricsError(materialsResult.response.status)) {
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

  const tasksPayload = tasksResult.response.ok && isBackendTopicTasksResponse(tasksResult.payload)
    ? tasksResult.payload
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

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const roadmapId = context.params.roadmapId;

  try {
    const roadmapResult = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}`,
      { method: "GET" }
    );

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

    const roadmapPayload = roadmapResult.payload;
    const mappedStages: RoadmapResponse["stages"] = [];

    const normalizedStages = isBackendRoadmapResponse(roadmapPayload)
      ? roadmapPayload.stages
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
        const metricsResult = await loadTopicMetrics(client, roadmapId, topic.id);
        if (metricsResult.errorResponse) {
          client.applyUpdatedSession(metricsResult.errorResponse);
          return metricsResult.errorResponse;
        }

        mappedTopics.push({
          id: topic.id,
          stageId: topic.stage_id ?? stage.id,
          title: topic.title,
          description: topic.description,
          goal: (topic as BackendFlatRoadmapTopic).goal ?? "",
          position:
            typeof topic.position === "number" && Number.isFinite(topic.position)
              ? topic.position
              : topicIndex + 1,
          status: topic.status,
          confidence: (topic as BackendFlatRoadmapTopic).confidence ?? null,
          progressPercent: metricsResult.metrics?.progressPercent ?? 0,
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

export async function PUT(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const roadmapId = context.params.roadmapId;

  try {
    const body = await request.json();
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}`,
      {
        method: "PUT",
        body
      }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Roadmap update failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = new NextResponse(null, { status: 204 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const roadmapId = context.params.roadmapId;

  try {
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}`,
      { method: "DELETE" }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Roadmap deletion failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = new NextResponse(null, { status: 204 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
