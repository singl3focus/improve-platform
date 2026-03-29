import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface BackendNote {
  id: string;
  topic_id: string;
  title: string;
  content: string;
  position: number;
  created_at: string;
  updated_at: string;
}

function mapNote(n: BackendNote) {
  return {
    id: n.id,
    topicId: n.topic_id,
    title: n.title,
    content: n.content,
    position: n.position,
    createdAt: n.created_at,
    updatedAt: n.updated_at
  };
}

interface RouteContext {
  params: { topicId: string };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  try {
    const topicId = encodeURIComponent(context.params.topicId);
    const result = await client.call(`/api/v1/topics/${topicId}/notes`, { method: "GET" });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load notes."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const notes = (result.payload as BackendNote[]).map(mapNote);
    const response = NextResponse.json(notes, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Notes backend is unavailable.");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  try {
    const topicId = encodeURIComponent(context.params.topicId);
    const body = await request.json();
    const result = await client.call(`/api/v1/topics/${topicId}/notes`, {
      method: "POST",
      body
    });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to create note."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const note = mapNote(result.payload as BackendNote);
    const response = NextResponse.json(note, { status: 201 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Notes backend is unavailable.");
  }
}
