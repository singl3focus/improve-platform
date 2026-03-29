import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";
import { getStringValue, isRecord } from "@shared/api/backend-shared";
import {
  isRoadmapTopicStatus
} from "@features/roadmap/lib/roadmap-topic-status";
import { buildRoadmapTopicUpdatePlan } from "@features/roadmap/lib/roadmap-topic-update-flow";
import { resolveRoadmapTopicUpdateRequest } from "@features/roadmap/lib/roadmap-topic-update-request";

interface RouteContext {
  params: {
    topicId: string;
  };
}

interface TopicUpdatePayload {
  title?: unknown;
  description?: unknown;
  status?: unknown;
  start_date?: unknown;
  target_date?: unknown;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  let payload: TopicUpdatePayload;
  try {
    payload = (await request.json()) as TopicUpdatePayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const client = createBackendClient(request);
  const topicId = context.params.topicId;

  try {
    const currentTopicResult = await client.call(
      `/api/v1/roadmap/topics/${encodeURIComponent(topicId)}`,
      { method: "GET" }
    );
    if (!currentTopicResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        currentTopicResult.response,
        currentTopicResult.payload,
        "Roadmap topic load failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const currentTopic = isRecord(currentTopicResult.payload) ? currentTopicResult.payload : null;
    const currentTitle = getStringValue(currentTopic, "title");
    const currentStatusValue = getStringValue(currentTopic, "status");
    const currentDescription = getStringValue(currentTopic, "description") ?? "";
    if (!currentTitle || !currentStatusValue || !isRoadmapTopicStatus(currentStatusValue)) {
      return NextResponse.json(
        {
          message: "Roadmap topic data is missing in backend response.",
          code: "invalid_status"
        },
        { status: 502 }
      );
    }

    const startDate = getStringValue(currentTopic, "start_date") ?? null;
    const targetDate = getStringValue(currentTopic, "target_date") ?? null;
    const currentPositionValue = Number((currentTopic as { position?: unknown } | null)?.position ?? 1);
    const position = Number.isFinite(currentPositionValue) && currentPositionValue > 0
      ? Math.floor(currentPositionValue)
      : 1;
    const resolvedRequest = resolveRoadmapTopicUpdateRequest(
      {
        title: currentTitle,
        description: currentDescription,
        status: currentStatusValue
      },
      payload
    );
    if (!resolvedRequest.ok) {
      return NextResponse.json({ message: resolvedRequest.message }, { status: 422 });
    }

    const { title, description, status: nextStatus, startDate: requestStartDate, targetDate: requestTargetDate } =
      resolvedRequest.value;

    const updatePlan = buildRoadmapTopicUpdatePlan({
      currentTopic: {
        status: currentStatusValue,
        position,
        startDate,
        targetDate
      },
      request: {
        title,
        description,
        status: nextStatus,
        startDate: requestStartDate,
        targetDate: requestTargetDate
      }
    });
    if (!updatePlan.ok) {
      return NextResponse.json(
        {
          message: updatePlan.message,
          code: updatePlan.code
        },
        { status: updatePlan.httpStatus }
      );
    }

    if (updatePlan.statusPayload) {
      const statusUpdateResult = await client.call(
        `/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/status`,
        {
          method: "PATCH",
          body: updatePlan.statusPayload
        }
      );
      if (!statusUpdateResult.response.ok) {
        const errorResponse = createBackendErrorResponse(
          statusUpdateResult.response,
          statusUpdateResult.payload,
          "Roadmap topic status update failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }
    }

    const updateResult = await client.call(`/api/v1/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "PUT",
      body: updatePlan.topicPayload
    });
    if (!updateResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        updateResult.response,
        updateResult.payload,
        "Roadmap topic update failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(
      {
        id: topicId,
        title,
        description,
        position: updatePlan.topicPayload.position,
        status: updatePlan.responseStatus
      },
      { status: 200 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const topicId = context.params.topicId;

  try {
    const deleteResult = await client.call(`/api/v1/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "DELETE"
    });
    if (!deleteResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        deleteResult.response,
        deleteResult.payload,
        "Roadmap topic removal failed."
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
