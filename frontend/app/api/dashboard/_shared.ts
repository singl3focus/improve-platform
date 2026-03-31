import { NextRequest, NextResponse } from "next/server";
import type {
  BackendMaterialResponse,
  BackendRoadmapResponse,
  BackendTaskResponse
} from "@shared/api/backend-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@shared/api/backend-client";
import { buildRoadmapTopicTitleMap } from "@features/roadmap/lib/roadmap-topic-helpers";
import { mapWithConcurrency } from "@shared/lib/map-with-concurrency";

export interface MaterialWithTopic {
  material: BackendMaterialResponse;
  topicTitle: string;
}

interface DashboardRoadmapTopic {
  id: string;
  title: string;
  status: "not_started" | "in_progress" | "paused" | "completed";
  target_date?: string | null;
}

const DASHBOARD_FANOUT_CONCURRENCY = 6;
const DASHBOARD_BACKEND_TIMEOUT_MS = 8_000;

export function dashboardJson(
  client: ReturnType<typeof createBackendClient>,
  payload: unknown
): NextResponse {
  const response = NextResponse.json(payload, { status: 200 });
  client.applyUpdatedSession(response);
  return response;
}

export function dashboardUnavailableResponse(): NextResponse {
  return createBackendUnavailableResponse("Dashboard backend is unavailable.");
}

export async function loadRoadmapOrEmpty(
  client: ReturnType<typeof createBackendClient>,
  options: { signal?: AbortSignal } = {}
) {
  const listResult = await client.call("/api/v1/roadmaps", {
    method: "GET",
    signal: options.signal,
    timeoutMs: DASHBOARD_BACKEND_TIMEOUT_MS
  });
  if (!listResult.response.ok) {
    return {
      roadmap: null as BackendRoadmapResponse | null,
      errorResponse: createBackendErrorResponse(
        listResult.response,
        listResult.payload,
        "Failed to load roadmap."
      )
    };
  }

  const roadmapList = listResult.payload as Array<{ id: string }>;
  let roadmap: BackendRoadmapResponse | null = null;
  if (roadmapList.length > 0) {
    const rmResult = await client.call(`/api/v1/roadmaps/${encodeURIComponent(roadmapList[0].id)}`, {
      method: "GET",
      signal: options.signal,
      timeoutMs: DASHBOARD_BACKEND_TIMEOUT_MS
    });
    if (rmResult.response.ok) {
      roadmap = rmResult.payload as BackendRoadmapResponse;
    }
  }

  return {
    roadmap,
    errorResponse: null as NextResponse | null
  };
}

export const buildTopicTitleMap = buildRoadmapTopicTitleMap;

function getRoadmapTopics(roadmap: BackendRoadmapResponse | null) {
  if (!roadmap) {
    return [] as DashboardRoadmapTopic[];
  }

  if (Array.isArray((roadmap as { topics?: unknown }).topics)) {
    return (roadmap as unknown as { topics: DashboardRoadmapTopic[] }).topics;
  }

  return (roadmap.stages ?? []).flatMap((stage) => stage.topics ?? []) as DashboardRoadmapTopic[];
}

export function flattenRoadmapTopics(roadmap: BackendRoadmapResponse | null) {
  return getRoadmapTopics(roadmap);
}

export async function loadTasks(
  client: ReturnType<typeof createBackendClient>,
  options: { signal?: AbortSignal } = {}
) {
  const tasksResult = await client.call("/api/v1/tasks", {
    method: "GET",
    signal: options.signal,
    timeoutMs: DASHBOARD_BACKEND_TIMEOUT_MS
  });
  if (!tasksResult.response.ok) {
    return {
      tasks: null as BackendTaskResponse[] | null,
      errorResponse: createBackendErrorResponse(
        tasksResult.response,
        tasksResult.payload,
        "Failed to load tasks."
      )
    };
  }

  return {
    tasks: tasksResult.payload as BackendTaskResponse[],
    errorResponse: null as NextResponse | null
  };
}

export async function loadMaterials(
  client: ReturnType<typeof createBackendClient>,
  roadmap: BackendRoadmapResponse | null,
  options: { signal?: AbortSignal } = {}
) {
  const topics = getRoadmapTopics(roadmap);
  if (topics.length === 0) {
    return {
      materials: [] as MaterialWithTopic[],
      errorResponse: null as NextResponse | null
    };
  }

  const batches = await mapWithConcurrency(
    topics,
    async (topic) => {
      const materialsResult = await client.call(
        `/api/v1/roadmap/topics/${encodeURIComponent(topic.id)}/materials`,
        {
          method: "GET",
          signal: options.signal,
          timeoutMs: DASHBOARD_BACKEND_TIMEOUT_MS
        }
      );

      if (!materialsResult.response.ok) {
        if (
          materialsResult.response.status === 404 &&
          isBackendErrorCode(materialsResult.payload, "topic_not_found")
        ) {
          return {
            materials: [] as MaterialWithTopic[],
            errorResponse: null as NextResponse | null
          };
        }

        return {
          materials: [] as MaterialWithTopic[],
          errorResponse: createBackendErrorResponse(
            materialsResult.response,
            materialsResult.payload,
            "Failed to load materials."
          )
        };
      }

      return {
        materials: ((materialsResult.payload as BackendMaterialResponse[]) ?? []).map((material) => ({
          material,
          topicTitle: topic.title
        })),
        errorResponse: null as NextResponse | null
      };
    },
    {
      concurrency: DASHBOARD_FANOUT_CONCURRENCY,
      signal: options.signal
    }
  );

  const failedBatch = batches.find((batch) => batch.errorResponse);
  if (failedBatch?.errorResponse) {
    return {
      materials: [] as MaterialWithTopic[],
      errorResponse: failedBatch.errorResponse
    };
  }

  return {
    materials: batches.flatMap((batch) => batch.materials),
    errorResponse: null as NextResponse | null
  };
}

export function applyDashboardError(
  client: ReturnType<typeof createBackendClient>,
  response: NextResponse
): NextResponse {
  client.applyUpdatedSession(response);
  return response;
}

export function createDashboardClient(request: NextRequest) {
  return createBackendClient(request);
}
