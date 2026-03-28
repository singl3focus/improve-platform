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
    depTopicId: string;
  };
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const { roadmapId, topicId, depTopicId } = context.params;

  try {
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}/dependencies/${encodeURIComponent(depTopicId)}`,
      { method: "DELETE" }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Dependency removal failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = new NextResponse(null, { status: 204 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
