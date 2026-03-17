import { NextRequest, NextResponse } from "next/server";
import type {
  BackendMaterialResponse,
  BackendRoadmapResponse,
  BackendTaskResponse
} from "@/lib/backend-learning-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@/lib/backend-api";
import { buildRoadmapTopicTitleMap } from "@/lib/roadmap-topic-helpers";

export interface MaterialWithTopic {
  material: BackendMaterialResponse;
  topicTitle: string;
}

interface DashboardRoadmapTopic {
  id: string;
  title: string;
  status: "not_started" | "in_progress" | "paused" | "completed";
  is_blocked: boolean;
  block_reasons?: string[];
  target_date?: string | null;
}

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

export async function loadRoadmapOrEmpty(client: ReturnType<typeof createBackendClient>) {
  const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });
  if (!roadmapResult.response.ok) {
    if (
      roadmapResult.response.status === 404 &&
      isBackendErrorCode(roadmapResult.payload, "roadmap_not_found")
    ) {
      return {
        roadmap: null as BackendRoadmapResponse | null,
        errorResponse: null as NextResponse | null
      };
    }

    return {
      roadmap: null as BackendRoadmapResponse | null,
      errorResponse: createBackendErrorResponse(
        roadmapResult.response,
        roadmapResult.payload,
        "Failed to load roadmap."
      )
    };
  }

  return {
    roadmap: roadmapResult.payload as BackendRoadmapResponse,
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

export async function loadTasks(client: ReturnType<typeof createBackendClient>) {
  const tasksResult = await client.call("/api/v1/tasks", { method: "GET" });
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
  roadmap: BackendRoadmapResponse | null
) {
  const topics = getRoadmapTopics(roadmap);
  if (topics.length === 0) {
    return {
      materials: [] as MaterialWithTopic[],
      errorResponse: null as NextResponse | null
    };
  }

  const materials: MaterialWithTopic[] = [];
  for (const topic of topics) {
    const materialsResult = await client.call(
      `/api/v1/roadmap/topics/${encodeURIComponent(topic.id)}/materials`,
      { method: "GET" }
    );

    if (!materialsResult.response.ok) {
      if (
        materialsResult.response.status === 404 &&
        isBackendErrorCode(materialsResult.payload, "topic_not_found")
      ) {
        continue;
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

    for (const material of (materialsResult.payload as BackendMaterialResponse[]) ?? []) {
      materials.push({
        material,
        topicTitle: topic.title
      });
    }
  }

  return {
    materials,
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
