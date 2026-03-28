import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface RouteContext {
  params: {
    topicId: string;
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { topicId } = context.params;
  const client = createBackendClient(request);
  try {
    const body = await request.json();
    const result = await client.call(
      `/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/confidence`,
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
