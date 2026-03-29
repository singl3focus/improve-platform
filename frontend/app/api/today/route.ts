import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface BackendTodayTask {
  id: string;
  title: string;
  topic_title: string | null;
  deadline: string | null;
  status: string;
  is_completed: boolean;
  position: number;
}

interface BackendTodayMaterial {
  id: string;
  title: string;
  topic_title: string;
  type: string;
  completed_amount: number;
  total_amount: number;
  progress_percent: number;
}

interface BackendTodayResponse {
  date: string;
  tasks: BackendTodayTask[];
  current_material: BackendTodayMaterial | null;
  reflection: string | null;
}

function mapTask(t: BackendTodayTask) {
  return {
    id: t.id,
    title: t.title,
    topicTitle: t.topic_title,
    deadline: t.deadline,
    status: t.status,
    isCompleted: t.is_completed,
    position: t.position
  };
}

function mapResponse(raw: BackendTodayResponse) {
  return {
    date: raw.date,
    tasks: (raw.tasks ?? []).map(mapTask),
    currentMaterial: raw.current_material ? {
      id: raw.current_material.id,
      title: raw.current_material.title,
      topicTitle: raw.current_material.topic_title,
      type: raw.current_material.type,
      completedAmount: raw.current_material.completed_amount,
      totalAmount: raw.current_material.total_amount,
      progressPercent: raw.current_material.progress_percent
    } : null,
    reflection: raw.reflection
  };
}

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);
  try {
    const result = await client.call("/api/v1/today", { method: "GET" });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load today data."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const mapped = mapResponse(result.payload as BackendTodayResponse);
    const response = NextResponse.json(mapped, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Today backend is unavailable.");
  }
}
