import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";
import { normalizeText } from "@shared/api/payload-parsers";
import { getNextTopicPosition } from "@features/roadmap/lib/roadmap-topic-position";

interface TopicCreatePayload {
  title?: unknown;
  description?: unknown;
  position?: unknown;
  direction?: unknown;
  relative_to_topic_id?: unknown;
}

export async function POST(request: NextRequest) {
  let payload: TopicCreatePayload;
  try {
    payload = (await request.json()) as TopicCreatePayload;
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

  if (payload.direction !== undefined && typeof payload.direction !== "string") {
    return NextResponse.json({ message: "Direction must be a string." }, { status: 422 });
  }

  if (
    payload.relative_to_topic_id !== undefined &&
    typeof payload.relative_to_topic_id !== "string"
  ) {
    return NextResponse.json(
      { message: "relative_to_topic_id must be a string." },
      { status: 422 }
    );
  }

  if (
    payload.position !== undefined &&
    (typeof payload.position !== "number" ||
      !Number.isFinite(payload.position) ||
      payload.position < 1)
  ) {
    return NextResponse.json({ message: "Position must be a positive number." }, { status: 422 });
  }

  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const requestedPosition =
    typeof payload.position === "number" ? Math.trunc(payload.position) : null;
  const requestedDirection =
    typeof payload.direction === "string" ? payload.direction.trim().toLowerCase() : "";
  const requestedRelativeTopicId =
    typeof payload.relative_to_topic_id === "string" ? payload.relative_to_topic_id.trim() : "";
  const isDirectionalCreate = requestedDirection.length > 0 || requestedRelativeTopicId.length > 0;

  if (isDirectionalCreate) {
    if (!requestedRelativeTopicId) {
      return NextResponse.json(
        { message: "relative_to_topic_id is required for directional create." },
        { status: 422 }
      );
    }

    if (
      requestedDirection !== "left" &&
      requestedDirection !== "right" &&
      requestedDirection !== "below"
    ) {
      return NextResponse.json(
        { message: "direction must be one of: left, right, below." },
        { status: 422 }
      );
    }
  }

  const client = createBackendClient(request);

  try {
    if (isDirectionalCreate) {
      const createResult = await client.call("/api/v1/roadmap/topics", {
        method: "POST",
        body: {
          title,
          description,
          direction: requestedDirection,
          relative_to_topic_id: requestedRelativeTopicId
        }
      });

      if (!createResult.response.ok) {
        const errorResponse = createBackendErrorResponse(
          createResult.response,
          createResult.payload,
          "Roadmap topic creation failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }

      const response = NextResponse.json(createResult.payload, { status: 201 });
      client.applyUpdatedSession(response);
      return response;
    }

    let fallbackPosition = requestedPosition ?? 1;
    const listResult = await client.call("/api/v1/roadmaps", { method: "GET" });
    if (!listResult.response.ok) {
      if (listResult.response.status < 500) {
        const errorResponse = createBackendErrorResponse(
          listResult.response,
          listResult.payload,
          "Roadmap load failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }
    } else {
      const roadmapList = listResult.payload as Array<{ id: string }>;
      if (roadmapList.length > 0 && requestedPosition === null) {
        const rmResult = await client.call(`/api/v1/roadmaps/${encodeURIComponent(roadmapList[0].id)}`, { method: "GET" });
        if (rmResult.response.ok) {
          fallbackPosition = getNextTopicPosition(rmResult.payload);
        }
      }
    }

    const createResult = await client.call("/api/v1/roadmap/topics", {
      method: "POST",
      body: {
        title,
        description,
        position: fallbackPosition
      }
    });

    if (!createResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        createResult.response,
        createResult.payload,
        "Roadmap topic creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(createResult.payload, { status: 201 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
