import { NextRequest, NextResponse } from "next/server";
import type {
  BackendRoadmapResponse,
  BackendTaskResponse
} from "@shared/api/backend-contracts";
import {
  isTaskDueWithinWeek,
  isTaskOverdue,
  mapBackendTaskStatusToBoard
} from "@features/tasks/lib/backend-learning-mappers";
import type { TaskBoardDueFilter } from "@features/tasks/types";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";
import { buildRoadmapTopicTitleMap } from "@features/roadmap/lib/roadmap-topic-helpers";
import { normalizeText } from "@shared/api/payload-parsers";

function parseDueFilter(value: string | null): TaskBoardDueFilter {
  if (value === "overdue" || value === "week") {
    return value;
  }
  return "all";
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
  topicTitleMap: Map<string, string> | null = null
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
    topicTitle: task.topic_id ? (topicTitleMap?.get(task.topic_id) ?? null) : null,
    dueAt: task.deadline ?? "",
    status: mapBackendTaskStatusToBoard(task.status)
  };
}

function getNextTaskPosition(tasks: BackendTaskResponse[]): number {
  const maxPosition = tasks.reduce((max, task) => {
    if (typeof task.position !== "number" || !Number.isFinite(task.position)) {
      return max;
    }
    return Math.max(max, task.position);
  }, 0);

  return maxPosition + 1;
}

async function resolveTaskCreatePosition(
  client: ReturnType<typeof createBackendClient>
): Promise<number> {
  const tasksResult = await client.call("/api/v1/tasks", { method: "GET" });
  if (!tasksResult.response.ok) {
    return 1;
  }

  const existingTasks = Array.isArray(tasksResult.payload)
    ? (tasksResult.payload as BackendTaskResponse[])
    : [];
  return getNextTaskPosition(existingTasks);
}

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);

  try {
    const topicId = request.nextUrl.searchParams.get("topicId");
    const due = parseDueFilter(request.nextUrl.searchParams.get("due"));

    const path = topicId
      ? `/api/v1/tasks?topic_id=${encodeURIComponent(topicId)}`
      : "/api/v1/tasks";
    const tasksResult = await client.call(path, { method: "GET" });

    if (!tasksResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        tasksResult.response,
        tasksResult.payload,
        "Tasks board request failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const listResult = await client.call("/api/v1/roadmaps", { method: "GET" });
    if (!listResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        listResult.response,
        listResult.payload,
        "Failed to load topics for tasks board."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const roadmapList = listResult.payload as Array<{ id: string }>;
    let roadmap: BackendRoadmapResponse | null = null;
    if (roadmapList.length > 0) {
      const rmResult = await client.call(`/api/v1/roadmaps/${encodeURIComponent(roadmapList[0].id)}`, { method: "GET" });
      if (rmResult.response.ok) {
        roadmap = rmResult.payload as BackendRoadmapResponse;
      }
    }
    const topicTitleMap = buildRoadmapTopicTitleMap(roadmap);
    const tasks = (tasksResult.payload as BackendTaskResponse[])
      .filter((task) => {
        if (due === "overdue") {
          return isTaskOverdue(task);
        }
        if (due === "week") {
          return isTaskDueWithinWeek(task.deadline);
        }
        return true;
      })
      .map((task) => toTaskBoardItem(task, topicTitleMap));

    const topics = Array.from(topicTitleMap.entries()).map(([id, title]) => ({ id, title }));

    const response = NextResponse.json(
      {
        tasks,
        topics
      },
      { status: 200 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Tasks backend is unavailable.");
  }
}

export async function POST(request: NextRequest) {
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
    const position = await resolveTaskCreatePosition(client);

    const createResult = await client.call("/api/v1/tasks", {
      method: "POST",
      body: {
        title,
        description,
        topic_id: topicId,
        ...(deadline ? { deadline } : {}),
        position
      }
    });

    if (!createResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        createResult.response,
        createResult.payload,
        "Task creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(toTaskBoardItem(createResult.payload as BackendTaskResponse), {
      status: 201
    });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Tasks backend is unavailable.");
  }
}
