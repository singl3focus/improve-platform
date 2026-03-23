import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@/lib/backend-api";
import { normalizeText } from "@/lib/payload-parsers";
import { getNextTopicPosition } from "@/lib/roadmap-topic-position";
import { buildDirectionalDependencyPlan } from "@/lib/roadmap-topic-create";

interface TopicCreatePayload {
  title?: unknown;
  description?: unknown;
  position?: unknown;
  direction?: unknown;
  relative_to_topic_id?: unknown;
}

function readCreatedTopicId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const topLevelId = (payload as { id?: unknown }).id;
  if (typeof topLevelId === "string" && topLevelId.trim()) {
    return topLevelId.trim();
  }

  const nestedTopicId =
    (payload as { topic?: { id?: unknown } }).topic?.id ??
    (payload as { data?: { id?: unknown } }).data?.id;
  if (typeof nestedTopicId === "string" && nestedTopicId.trim()) {
    return nestedTopicId.trim();
  }

  return null;
}

function isIgnoredDirectionalRepairError(response: Response, payload: unknown): boolean {
  if (response.status === 404 && isBackendErrorCode(payload, "dependency_not_found")) {
    return true;
  }

  if (response.status === 409) {
    return (
      isBackendErrorCode(payload, "dependency_exists") ||
      isBackendErrorCode(payload, "duplicate_dependency") ||
      isBackendErrorCode(payload, "already_exists")
    );
  }

  return false;
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

      const createdTopicId = readCreatedTopicId(createResult.payload);
      if (createdTopicId && createdTopicId !== requestedRelativeTopicId) {
        const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });

        if (roadmapResult.response.ok) {
          const plan = buildDirectionalDependencyPlan({
            roadmapPayload: roadmapResult.payload,
            parentTopicId: requestedRelativeTopicId,
            createdTopicId
          });

          if (plan.shouldAddParentDependsOnCreated) {
            const addResult = await client.call(
              `/api/v1/roadmap/topics/${encodeURIComponent(requestedRelativeTopicId)}/dependencies`,
              {
                method: "POST",
                body: {
                  depends_on_topic_id: createdTopicId
                }
              }
            );

            if (
              !addResult.response.ok &&
              !isIgnoredDirectionalRepairError(addResult.response, addResult.payload)
            ) {
              const errorResponse = createBackendErrorResponse(
                addResult.response,
                addResult.payload,
                "Roadmap directional dependency normalization failed."
              );
              client.applyUpdatedSession(errorResponse);
              return errorResponse;
            }
          }

          if (plan.shouldRemoveCreatedDependsOnParent) {
            const removeResult = await client.call(
              `/api/v1/roadmap/topics/${encodeURIComponent(createdTopicId)}/dependencies/${encodeURIComponent(requestedRelativeTopicId)}`,
              {
                method: "DELETE"
              }
            );

            if (
              !removeResult.response.ok &&
              !isIgnoredDirectionalRepairError(removeResult.response, removeResult.payload)
            ) {
              const errorResponse = createBackendErrorResponse(
                removeResult.response,
                removeResult.payload,
                "Roadmap directional dependency normalization failed."
              );
              client.applyUpdatedSession(errorResponse);
              return errorResponse;
            }
          }
        }
      }

      const response = NextResponse.json(createResult.payload, { status: 201 });
      client.applyUpdatedSession(response);
      return response;
    }

    let fallbackPosition = requestedPosition ?? 1;
    const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });
    if (!roadmapResult.response.ok) {
      if (roadmapResult.response.status < 500) {
        const errorResponse = createBackendErrorResponse(
          roadmapResult.response,
          roadmapResult.payload,
          "Roadmap load failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }
    } else {
      if (requestedPosition === null) {
        fallbackPosition = getNextTopicPosition(roadmapResult.payload);
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
