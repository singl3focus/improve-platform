import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

export async function PUT(request: NextRequest) {
  const client = createBackendClient(request);
  try {
    const body = await request.json();
    const result = await client.call("/api/v1/today/tasks", {
      method: "PUT",
      body
    });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to update today tasks."
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
