import { NextRequest, NextResponse } from "next/server";
import type {
  BackendMaterialResponse,
  BackendRoadmapResponse,
  BackendRoadmapTopic,
  BackendTopicTasksResponse
} from "@shared/api/backend-contracts";
import { mapBackendTaskStatusToChecklist } from "@features/tasks/lib/backend-learning-mappers";
import type { TopicWorkspace } from "@features/topics/types";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@shared/api/backend-client";

interface RouteContext {
  params: {
    topicId: string;
  };
}

function createEmptyTopicWorkspace(topicId: string): TopicWorkspace {
  return {
    id: topicId,
    title: "Topic workspace",
    description: "Create this topic in your roadmap to start working with tasks and materials.",
    goal: "",
    status: "not_started",
    confidence: null,
    progressPercent: 0,
    startDate: "",
    targetDate: "",
    completedAt: null,
    dependencies: [],
    checklist: [],
    materials: []
  };
}

function buildTopicMap(roadmap: BackendRoadmapResponse | null): Map<string, BackendRoadmapTopic> {
  const map = new Map<string, BackendRoadmapTopic>();

  if (!roadmap) {
    return map;
  }

  for (const stage of roadmap.stages ?? []) {
    for (const topic of stage.topics ?? []) {
      map.set(topic.id, topic);
    }
  }

  return map;
}

function buildProgressPercent(tasks: BackendTopicTasksResponse | null): number {
  if (!tasks) {
    return 0;
  }

  return Number.isFinite(tasks.percent) ? tasks.percent : 0;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const topicId = context.params.topicId;

  try {
    const topicResult = await client.call(`/api/v1/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "GET"
    });

    if (!topicResult.response.ok) {
      if (
        topicResult.response.status === 404 &&
        isBackendErrorCode(topicResult.payload, "topic_not_found")
      ) {
        const response = NextResponse.json(createEmptyTopicWorkspace(topicId), { status: 200 });
        client.applyUpdatedSession(response);
        return response;
      }

      const errorResponse = createBackendErrorResponse(
        topicResult.response,
        topicResult.payload,
        "Failed to load topic workspace."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const topic = topicResult.payload as BackendRoadmapTopic;

    let roadmap: BackendRoadmapResponse | null = null;
    if (topic.roadmap_id) {
      const roadmapResult = await client.call(`/api/v1/roadmaps/${encodeURIComponent(topic.roadmap_id)}`, { method: "GET" });
      if (
        !roadmapResult.response.ok &&
        !(
          roadmapResult.response.status === 404 &&
          isBackendErrorCode(roadmapResult.payload, "roadmap_not_found")
        )
      ) {
        const errorResponse = createBackendErrorResponse(
          roadmapResult.response,
          roadmapResult.payload,
          "Failed to load roadmap dependencies."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }
      roadmap = roadmapResult.response.ok
        ? (roadmapResult.payload as BackendRoadmapResponse)
        : null;
    }
    const topicMap = buildTopicMap(roadmap);

    const tasksResult = await client.call(`/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/tasks`, {
      method: "GET"
    });
    if (!tasksResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        tasksResult.response,
        tasksResult.payload,
        "Failed to load topic tasks."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const materialsResult = await client.call(
      `/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/materials`,
      { method: "GET" }
    );
    if (!materialsResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        materialsResult.response,
        materialsResult.payload,
        "Failed to load topic materials."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const topicTasks = tasksResult.payload as BackendTopicTasksResponse;
    const topicMaterials = materialsResult.payload as BackendMaterialResponse[];

    const responsePayload: TopicWorkspace = {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      goal: (topic as unknown as { goal?: string }).goal ?? "",
      status: topic.status,
      confidence: (topic as unknown as { confidence?: number | null }).confidence ?? null,
      progressPercent: buildProgressPercent(topicTasks),
      startDate: topic.start_date ?? "",
      targetDate: topic.target_date ?? "",
      completedAt: topic.completed_date ?? null,
      dependencies: (topic.dependencies ?? []).map((dependencyId) => {
        const dependencyTopic = topicMap.get(dependencyId);
        return {
          topicId: dependencyId,
          title: dependencyTopic?.title ?? dependencyId,
          isCompleted: dependencyTopic?.status === "completed",
          isRequired: true
        };
      }),
      checklist: (topicTasks.tasks ?? [])
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: mapBackendTaskStatusToChecklist(task.status)
        })),
      materials: (topicMaterials ?? [])
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((material) => ({
          id: material.id,
          title: material.title,
          description: material.description,
          position: material.position,
          progressPercent: material.progress
        }))
    };

    const response = NextResponse.json(responsePayload, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Topic backend is unavailable.");
  }
}

