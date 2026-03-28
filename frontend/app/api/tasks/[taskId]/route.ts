import { NextRequest, NextResponse } from "next/server";
import type {
  BackendRoadmapResponse,
  BackendTaskResponse
} from "@shared/api/backend-contracts";
import { mapBackendTaskStatusToBoard } from "@features/tasks/lib/backend-learning-mappers";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";
import { buildRoadmapTopicTitleMap } from "@features/roadmap/lib/roadmap-topic-helpers";
import { normalizeText } from "@shared/api/payload-parsers";

interface RouteContext {
  params: {
    taskId: string;
  };
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
}

function toTaskBoardItem(
  task: BackendTaskResponse,
  topicTitleMap: Map<string, string>
): {
  id: string;
  title: string;
  description: string;
  topicId: string | null;
  topicTitle: string | null;
  dueAt: string;
  status: ReturnType<typeof mapBackendTaskStatusToBoard>;
} {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    topicId: task.topic_id,
    topicTitle: task.topic_id ? (topicTitleMap.get(task.topic_id) ?? null) : null,
    dueAt: task.deadline ?? "",
    status: mapBackendTaskStatusToBoard(task.status)
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  let payload: {
    title?: unknown;
    description?: unknown;
    topicId?: unknown;
    deadline?: unknown;
  };
  try {
    payload = (await request.json()) as {
      title?: unknown;
      description?: unknown;
      topicId?: unknown;
      deadline?: unknown;
    };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const title = normalizeText(payload.title);
  if (!title) {
    return NextResponse.json({ message: "Title must be a non-empty string." }, { status: 422 });
  }

  const description = normalizeText(payload.description) ?? "";
  const topicId = normalizeText(payload.topicId) ?? null;
  const deadline = normalizeText(payload.deadline) ?? null;

  if (deadline && !isValidDateString(deadline)) {
    return NextResponse.json({ message: "Deadline must be in YYYY-MM-DD format." }, { status: 422 });
  }

  const client = createBackendClient(request);

  try {
    const currentTaskResult = await client.call(
      `/api/v1/tasks/${encodeURIComponent(context.params.taskId)}`,
      {
        method: "GET"
      }
    );

    if (!currentTaskResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        currentTaskResult.response,
        currentTaskResult.payload,
        "Failed to load task before update."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const currentTask = currentTaskResult.payload as BackendTaskResponse;

    const updateResult = await client.call(`/api/v1/tasks/${encodeURIComponent(context.params.taskId)}`, {
      method: "PUT",
      body: {
        title,
        description,
        topic_id: topicId,
        ...(deadline ? { deadline } : {}),
        position: currentTask.position
      }
    });

    if (!updateResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        updateResult.response,
        updateResult.payload,
        "Task update failed."
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

    const response = NextResponse.json(toTaskBoardItem(task, topicTitleMap), { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Tasks backend is unavailable.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);

  try {
    const deleteResult = await client.call(`/api/v1/tasks/${encodeURIComponent(context.params.taskId)}`, {
      method: "DELETE"
    });

    if (!deleteResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        deleteResult.response,
        deleteResult.payload,
        "Task removal failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Tasks backend is unavailable.");
  }
}
