import { NextRequest, NextResponse } from "next/server";
import type { BackendRoadmapResponse } from "@shared/api/backend-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@shared/api/backend-client";

interface QuickCreatePayload {
  roadmapTitle?: unknown;
  topicTitle?: unknown;
  topicDescription?: unknown;
}

const DEFAULT_ROADMAP_TITLE = "Learning roadmap";

function normalizeNonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getRoadmapTopics(roadmap: BackendRoadmapResponse): Array<{ position?: number }> {
  if (Array.isArray((roadmap as { topics?: unknown }).topics)) {
    return (roadmap as unknown as { topics: Array<{ position?: number }> }).topics;
  }

  if (Array.isArray(roadmap.stages)) {
    return roadmap.stages.flatMap((stage) => stage.topics ?? []);
  }

  return [];
}

function getNextTopicPosition(roadmap: BackendRoadmapResponse): number {
  const topics = getRoadmapTopics(roadmap);
  const maxPosition = topics.reduce((max, topic) => {
    if (typeof topic.position !== "number" || !Number.isFinite(topic.position)) {
      return max;
    }

    return Math.max(max, topic.position);
  }, 0);

  return maxPosition + 1;
}

export async function POST(request: NextRequest) {
  let payload: QuickCreatePayload;
  try {
    payload = (await request.json()) as QuickCreatePayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const topicTitle = normalizeNonEmptyText(payload.topicTitle);
  if (!topicTitle) {
    return NextResponse.json({ message: "Topic title must be a non-empty string." }, { status: 422 });
  }

  if (payload.topicDescription !== undefined && typeof payload.topicDescription !== "string") {
    return NextResponse.json({ message: "Topic description must be a string." }, { status: 422 });
  }

  const topicDescription =
    typeof payload.topicDescription === "string" ? payload.topicDescription.trim() : "";
  const roadmapTitle = normalizeNonEmptyText(payload.roadmapTitle) ?? DEFAULT_ROADMAP_TITLE;
  const client = createBackendClient(request);

  try {
    const createRoadmapResult = await client.call("/api/v1/roadmap", {
      method: "POST",
      body: { title: roadmapTitle }
    });

    if (
      !createRoadmapResult.response.ok &&
      !(
        createRoadmapResult.response.status === 409 &&
        isBackendErrorCode(createRoadmapResult.payload, "roadmap_exists")
      )
    ) {
      const errorResponse = createBackendErrorResponse(
        createRoadmapResult.response,
        createRoadmapResult.payload,
        "Roadmap creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    let nextTopicPosition = 1;
    if (createRoadmapResult.response.status !== 201) {
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
        const roadmap = roadmapResult.payload as BackendRoadmapResponse;
        nextTopicPosition = getNextTopicPosition(roadmap);
      }
    }

    const topicBody = {
      title: topicTitle,
      description: topicDescription,
      position: nextTopicPosition
    };

    const createTopicResult = await client.call("/api/v1/roadmap/topics", {
      method: "POST",
      body: topicBody
    });

    if (!createTopicResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        createTopicResult.response,
        createTopicResult.payload,
        "Roadmap topic creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const createdTopic = createTopicResult.payload as { id?: string; title?: string };
    const response = NextResponse.json(
      {
        topicId: createdTopic.id ?? null,
        topicTitle: createdTopic.title ?? topicTitle
      },
      { status: 201 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
