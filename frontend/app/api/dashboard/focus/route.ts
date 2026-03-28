import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface BackendFocusTask {
  id: string;
  title: string;
  topic_id: string | null;
  topic_title: string | null;
  status: string;
  deadline: string | null;
  priority_level: string;
}

interface BackendFocusTopic {
  id: string;
  title: string;
  last_task_title: string;
  progress_percent: number;
}

interface BackendFocusResponse {
  primary_task: BackendFocusTask | null;
  secondary_tasks: BackendFocusTask[];
  continue_topic: BackendFocusTopic | null;
}

function mapFocusTask(t: BackendFocusTask) {
  return {
    id: t.id,
    title: t.title,
    topicId: t.topic_id,
    topicTitle: t.topic_title,
    status: t.status,
    deadline: t.deadline,
    priorityLevel: t.priority_level
  };
}

function mapFocusResponse(raw: BackendFocusResponse) {
  return {
    primaryTask: raw.primary_task ? mapFocusTask(raw.primary_task) : null,
    secondaryTasks: (raw.secondary_tasks ?? []).map(mapFocusTask),
    continueTopic: raw.continue_topic ? {
      id: raw.continue_topic.id,
      title: raw.continue_topic.title,
      lastTaskTitle: raw.continue_topic.last_task_title,
      progressPercent: raw.continue_topic.progress_percent
    } : null
  };
}

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);
  try {
    const result = await client.call("/api/v1/dashboard/focus", { method: "GET" });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load focus data."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const mapped = mapFocusResponse(result.payload as BackendFocusResponse);
    const response = NextResponse.json(mapped, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Focus backend is unavailable.");
  }
}
