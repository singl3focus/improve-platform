import { NextRequest, NextResponse } from "next/server";
import type { BackendRoadmapResponse } from "@/lib/backend-learning-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@/lib/backend-api";
import { normalizeText, parseInteger } from "@/lib/payload-parsers";

interface TopicCreatePayload {
  title?: unknown;
  description?: unknown;
  position?: unknown;
}

function getNextTopicPosition(roadmap: BackendRoadmapResponse): number {
  const totalTopics = (roadmap.stages ?? []).reduce(
    (count, stage) => count + (stage.topics?.length ?? 0),
    0
  );
  return totalTopics + 1;
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

  let position: number | null = null;
  if ("position" in payload && payload.position !== undefined) {
    position = parseInteger(payload.position);
    if (position === null || position < 1) {
      return NextResponse.json(
        { message: "Position must be an integer greater than or equal to 1." },
        { status: 422 }
      );
    }
  }

  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const client = createBackendClient(request);

  try {
    const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });
    if (!roadmapResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        roadmapResult.response,
        roadmapResult.payload,
        "Roadmap load failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const roadmap = roadmapResult.payload as BackendRoadmapResponse;
    const fallbackPosition = getNextTopicPosition(roadmap);

    const createResult = await client.call("/api/v1/roadmap/topics", {
      method: "POST",
      body: {
        title,
        description,
        position: position ?? fallbackPosition
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
