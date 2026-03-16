import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@/lib/backend-api";

interface RouteContext {
  params: {
    taskId: string;
  };
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);

  try {
    const deleteResult = await client.call(`/api/v1/tasks/${encodeURIComponent(context.params.taskId)}`, {
      method: "DELETE"
    });

    if (!deleteResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        deleteResult.response,
        deleteResult.payload,
        "Task removal failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Tasks backend is unavailable.");
  }
}
