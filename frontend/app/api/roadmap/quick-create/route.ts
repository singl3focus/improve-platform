import { NextRequest, NextResponse } from "next/server";
import type { BackendRoadmapResponse } from "@/lib/backend-learning-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@/lib/backend-api";

interface QuickCreatePayload {
  roadmapTitle?: unknown;
  stageTitle?: unknown;
  topicTitle?: unknown;
  topicDescription?: unknown;
}

const DEFAULT_ROADMAP_TITLE = "Learning roadmap";
const DEFAULT_STAGE_TITLE = "Stage 1";

function normalizeNonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getNextTopicPosition(roadmap: BackendRoadmapResponse, stageId: string): number {
  const stage = (roadmap.stages ?? []).find((item) => item.id === stageId);
  if (!stage || !Array.isArray(stage.topics)) {
    return 1;
  }
  return stage.topics.length + 1;
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
  const stageTitle = normalizeNonEmptyText(payload.stageTitle) ?? DEFAULT_STAGE_TITLE;
  const client = createBackendClient(request);

  try {
    let roadmap: BackendRoadmapResponse | null = null;
    const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });

    if (roadmapResult.response.ok) {
      roadmap = roadmapResult.payload as BackendRoadmapResponse;
    } else if (
      roadmapResult.response.status === 404 &&
      isBackendErrorCode(roadmapResult.payload, "roadmap_not_found")
    ) {
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

      const reloadedRoadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });
      if (!reloadedRoadmapResult.response.ok) {
        const errorResponse = createBackendErrorResponse(
          reloadedRoadmapResult.response,
          reloadedRoadmapResult.payload,
          "Roadmap load after creation failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }

      roadmap = reloadedRoadmapResult.payload as BackendRoadmapResponse;
    } else {
      const errorResponse = createBackendErrorResponse(
        roadmapResult.response,
        roadmapResult.payload,
        "Roadmap load failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const existingStages = Array.isArray(roadmap.stages) ? [...roadmap.stages] : [];
    const sortedStages = existingStages.sort((left, right) => left.position - right.position);
    let stageId = sortedStages[0]?.id ?? "";

    if (!stageId) {
      const createStageResult = await client.call("/api/v1/roadmap/stages", {
        method: "POST",
        body: {
          title: stageTitle,
          position: 1
        }
      });

      if (!createStageResult.response.ok) {
        const errorResponse = createBackendErrorResponse(
          createStageResult.response,
          createStageResult.payload,
          "Roadmap stage creation failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }

      stageId = (createStageResult.payload as { id?: string }).id ?? "";
    }

    if (!stageId) {
      return NextResponse.json({ message: "Roadmap stage id is missing." }, { status: 500 });
    }

    const createTopicResult = await client.call("/api/v1/roadmap/topics", {
      method: "POST",
      body: {
        stage_id: stageId,
        title: topicTitle,
        description: topicDescription,
        position: getNextTopicPosition(roadmap, stageId)
      }
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

    const createdTopic = createTopicResult.payload as { id?: string; title?: string; stage_id?: string };
    const response = NextResponse.json(
      {
        stageId: createdTopic.stage_id ?? stageId,
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
