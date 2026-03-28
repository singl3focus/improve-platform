import { NextRequest, NextResponse } from "next/server";
import type {
  BackendRoadmapResponse,
  BackendTaskResponse
} from "@shared/api/backend-contracts";
import {
  mapBackendTaskStatusToBoard,
  mapBoardTaskStatusToBackend
} from "@features/tasks/lib/backend-learning-mappers";
import type { TaskBoardStatus } from "@features/tasks/types";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";
import { buildRoadmapTopicTitleMap } from "@features/roadmap/lib/roadmap-topic-helpers";

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

    const listResult = await client.call("/api/v1/roadmaps", { method: "GET" });
    let roadmap: BackendRoadmapResponse | null = null;
    if (listResult.response.ok) {
      const roadmapList = listResult.payload as Array<{ id: string }>;
      if (roadmapList.length > 0) {
        const rmResult = await client.call(`/api/v1/roadmaps/${encodeURIComponent(roadmapList[0].id)}`, { method: "GET" });
        if (rmResult.response.ok) {
          roadmap = rmResult.payload as BackendRoadmapResponse;
        }
      }
    } else {
      const errorResponse = createBackendErrorResponse(
        listResult.response,
        listResult.payload,
        "Failed to load task topic data."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
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
