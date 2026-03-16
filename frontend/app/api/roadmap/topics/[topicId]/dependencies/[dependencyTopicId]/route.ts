import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@/lib/backend-api";

interface RouteContext {
  params: {
    topicId: string;
    dependencyTopicId: string;
  };
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const topicId = context.params.topicId;
  const dependencyTopicId = context.params.dependencyTopicId;

  try {
    const removeResult = await client.call(
      `/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/dependencies/${encodeURIComponent(
        dependencyTopicId
      )}`,
      { method: "DELETE" }
    );

    if (!removeResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        removeResult.response,
        removeResult.payload,
        "Roadmap dependency removal failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
