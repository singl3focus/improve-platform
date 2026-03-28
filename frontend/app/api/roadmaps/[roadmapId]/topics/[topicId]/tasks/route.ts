import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface RouteContext {
  params: {
    roadmapId: string;
    topicId: string;
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const { roadmapId, topicId } = context.params;

  try {
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}/tasks`,
      { method: "GET" }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load topic tasks."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(result.payload, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
