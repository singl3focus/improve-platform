import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface RouteContext {
  params: { taskId: string };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  try {
    const body = await request.json();
    const taskId = encodeURIComponent(context.params.taskId);
    const result = await client.call(`/api/v1/today/tasks/${taskId}/toggle`, {
      method: "PATCH",
      body
    });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to toggle task."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const response = new NextResponse(null, { status: 204 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Today backend is unavailable.");
  }
}
