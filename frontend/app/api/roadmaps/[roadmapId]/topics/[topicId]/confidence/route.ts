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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const { roadmapId, topicId } = context.params;

  try {
    const body = await request.json();
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}/confidence`,
      {
        method: "PATCH",
        body
      }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to set confidence."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = new NextResponse(null, { status: 204 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Backend is unavailable.");
  }
}
