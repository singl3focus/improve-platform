import { NextRequest, NextResponse } from "next/server";
import type { TopicChecklistStatus } from "@/lib/topic-workspace-types";
import { mapChecklistStatusToBackend } from "@/lib/backend-learning-mappers";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@/lib/backend-api";

interface RouteContext {
  params: {
    topicId: string;
    itemId: string;
  };
}

function isChecklistStatus(value: string): value is TopicChecklistStatus {
  return value === "todo" || value === "in_progress" || value === "done";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let payload: { status?: string };
  try {
    payload = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.status || !isChecklistStatus(payload.status)) {
    return NextResponse.json(
      {
        message: "Invalid checklist status. Allowed: todo, in_progress, done."
      },
      { status: 422 }
    );
  }

  const client = createBackendClient(request);

  try {
    const updateResult = await client.call(
      `/api/v1/tasks/${encodeURIComponent(context.params.itemId)}/status`,
      {
        method: "PATCH",
        body: {
          status: mapChecklistStatusToBackend(payload.status)
        }
      }
    );

    if (!updateResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        updateResult.response,
        updateResult.payload,
        "Checklist update failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(
      {
        success: true,
        topicId: context.params.topicId,
        itemId: context.params.itemId
      },
      { status: 200 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Checklist backend is unavailable.");
  }
}

