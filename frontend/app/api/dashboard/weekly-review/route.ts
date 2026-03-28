import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface BackendReviewTask {
  id: string;
  title: string;
  topic_title: string | null;
  deadline: string | null;
  status: string;
}

interface BackendReviewTopic {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
  target_date: string | null;
}

interface BackendWeeklyReviewData {
  period_start: string;
  period_end: string;
  completed_tasks: BackendReviewTask[];
  completed_topics: BackendReviewTopic[];
  stuck_tasks: BackendReviewTask[];
  stuck_topics: BackendReviewTopic[];
  upcoming_tasks: BackendReviewTask[];
  active_topics: BackendReviewTopic[];
  progress_before: number;
  progress_now: number;
}

function mapTask(t: BackendReviewTask) {
  return {
    id: t.id,
    title: t.title,
    topicTitle: t.topic_title,
    deadline: t.deadline,
    status: t.status
  };
}

function mapTopic(t: BackendReviewTopic) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    progressPercent: t.progress_percent,
    targetDate: t.target_date
  };
}

function mapWeeklyReview(raw: BackendWeeklyReviewData) {
  return {
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
    completedTasks: (raw.completed_tasks ?? []).map(mapTask),
    completedTopics: (raw.completed_topics ?? []).map(mapTopic),
    stuckTasks: (raw.stuck_tasks ?? []).map(mapTask),
    stuckTopics: (raw.stuck_topics ?? []).map(mapTopic),
    upcomingTasks: (raw.upcoming_tasks ?? []).map(mapTask),
    activeTopics: (raw.active_topics ?? []).map(mapTopic),
    progressBefore: raw.progress_before ?? 0,
    progressNow: raw.progress_now ?? 0
  };
}

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);
  try {
    const result = await client.call("/api/v1/dashboard/weekly-review", { method: "GET" });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load weekly review data."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const mapped = mapWeeklyReview(result.payload as BackendWeeklyReviewData);
    const response = NextResponse.json(mapped, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Weekly review backend is unavailable.");
  }
}

export async function POST(request: NextRequest) {
  const client = createBackendClient(request);
  try {
    const body = await request.json();
    const result = await client.call("/api/v1/dashboard/weekly-review", {
      method: "POST",
      body
    });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to save weekly review."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const response = new NextResponse(null, { status: 201 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Weekly review backend is unavailable.");
  }
}
