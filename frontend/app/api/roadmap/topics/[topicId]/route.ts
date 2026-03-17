import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@/lib/backend-api";
import { getStringValue, isRecord } from "@/lib/backend-shared";
import { normalizeText, parseInteger } from "@/lib/payload-parsers";

interface RouteContext {
  params: {
    topicId: string;
  };
}

interface TopicUpdatePayload {
  title?: unknown;
  description?: unknown;
  position?: unknown;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  let payload: TopicUpdatePayload;
  try {
    payload = (await request.json()) as TopicUpdatePayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const title = normalizeText(payload.title);
  if (!title) {
    return NextResponse.json({ message: "Title is required." }, { status: 422 });
  }

  if (payload.description !== undefined && typeof payload.description !== "string") {
    return NextResponse.json({ message: "Description must be a string." }, { status: 422 });
  }

  const position = parseInteger(payload.position);
  if (position === null || position < 1) {
    return NextResponse.json(
      { message: "Position must be an integer greater than or equal to 1." },
      { status: 422 }
    );
  }

  const description = typeof payload.description === "string" ? payload.description.trim() : "";
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
    const startDate = getStringValue(currentTopic, "start_date") ?? null;
    const targetDate = getStringValue(currentTopic, "target_date") ?? null;

    const updateResult = await client.call(`/api/v1/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "PUT",
      body: {
        title,
        description,
        position,
        start_date: startDate,
        target_date: targetDate
      }
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
        position
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
