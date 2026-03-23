import { NextRequest, NextResponse } from "next/server";
import type {
  BackendRoadmapResponse,
  BackendTaskResponse
} from "@/lib/backend-learning-contracts";
import { mapBackendTaskStatusToBoard } from "@/lib/backend-learning-mappers";
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

  if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
    return NextResponse.json({ message: "Title must be a non-empty string." }, { status: 422 });
  }

  if (payload.description !== undefined && typeof payload.description !== "string") {
    return NextResponse.json({ message: "Description must be a string." }, { status: 422 });
  }

  if (payload.topicId !== undefined && payload.topicId !== null && typeof payload.topicId !== "string") {
    return NextResponse.json({ message: "Topic id must be a string." }, { status: 422 });
  }

  if (payload.deadline !== undefined && payload.deadline !== null && typeof payload.deadline !== "string") {
    return NextResponse.json({ message: "Deadline must be a string in YYYY-MM-DD format." }, { status: 422 });
  }

  const title = payload.title.trim();
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const topicId =
    typeof payload.topicId === "string" && payload.topicId.trim().length > 0
      ? payload.topicId.trim()
      : null;
  const deadlineRaw = typeof payload.deadline === "string" ? payload.deadline.trim() : "";
  const deadline = deadlineRaw.length > 0 ? deadlineRaw : null;

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
