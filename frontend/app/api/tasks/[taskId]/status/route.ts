import { NextRequest, NextResponse } from "next/server";
import type {
  BackendRoadmapResponse,
  BackendTaskResponse
} from "@/lib/backend-learning-contracts";
import {
  mapBackendTaskStatusToBoard,
  mapBoardTaskStatusToBackend
} from "@/lib/backend-learning-mappers";
import type { TaskBoardStatus } from "@/lib/tasks-board-types";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@/lib/backend-api";
import { buildRoadmapTopicTitleMap } from "@/lib/roadmap-topic-helpers";

interface RouteContext {
  params: {
    taskId: string;
  };
}

function isTaskStatus(value: string): value is TaskBoardStatus {
  return value === "new" || value === "in_progress" || value === "paused" || value === "completed";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let payload: { status?: string };
  try {
    payload = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.status || !isTaskStatus(payload.status)) {
    return NextResponse.json(
      {
        message: "Invalid task status. Allowed: new, in_progress, paused, completed."
      },
      { status: 422 }
    );
  }

  const client = createBackendClient(request);

  try {
    const updateResult = await client.call(
      `/api/v1/tasks/${encodeURIComponent(context.params.taskId)}/status`,
      {
        method: "PATCH",
        body: {
          status: mapBoardTaskStatusToBackend(payload.status)
        }
      }
    );

    if (!updateResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        updateResult.response,
        updateResult.payload,
        "Task status update failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const taskResult = await client.call(`/api/v1/tasks/${encodeURIComponent(context.params.taskId)}`, {
      method: "GET"
    });
    if (!taskResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        taskResult.response,
        taskResult.payload,
        "Failed to load updated task."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });
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
        "Failed to load task topic data."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const roadmap = roadmapResult.response.ok
      ? (roadmapResult.payload as BackendRoadmapResponse)
      : null;
    const topicTitleMap = buildRoadmapTopicTitleMap(roadmap);
    const task = taskResult.payload as BackendTaskResponse;

    const response = NextResponse.json(
      {
        id: task.id,
        title: task.title,
        description: task.description,
        topicId: task.topic_id,
        topicTitle: task.topic_id ? (topicTitleMap.get(task.topic_id) ?? null) : null,
        dueAt: task.deadline ?? "",
        status: mapBackendTaskStatusToBoard(task.status)
      },
      { status: 200 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Tasks backend is unavailable.");
  }
}
