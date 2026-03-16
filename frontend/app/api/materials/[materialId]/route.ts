import { NextRequest, NextResponse } from "next/server";
import type {
  BackendMaterialResponse,
  BackendRoadmapResponse
} from "@/lib/backend-learning-contracts";
import type { UpdateLibraryMaterialInput } from "@/lib/materials-library-types";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@/lib/backend-api";
import { normalizeText, parseInteger } from "@/lib/payload-parsers";
import { buildRoadmapTopicTitleMap } from "@/lib/roadmap-topic-helpers";

interface RouteContext {
  params: {
    materialId: string;
  };
}

async function loadTopicTitleMap(client: ReturnType<typeof createBackendClient>) {
  const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });
  if (!roadmapResult.response.ok) {
    if (
      roadmapResult.response.status === 404 &&
      isBackendErrorCode(roadmapResult.payload, "roadmap_not_found")
    ) {
      return {
        topicTitleMap: new Map<string, string>(),
        errorResponse: null as NextResponse | null
      };
    }

    return {
      topicTitleMap: new Map<string, string>(),
      errorResponse: createBackendErrorResponse(
        roadmapResult.response,
        roadmapResult.payload,
        "Failed to load roadmap topics."
      )
    };
  }

  const roadmap = roadmapResult.payload as BackendRoadmapResponse;
  return {
    topicTitleMap: buildRoadmapTopicTitleMap(roadmap),
    errorResponse: null as NextResponse | null
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let payload: {
    title?: unknown;
    description?: unknown;
    topicId?: unknown;
    position?: unknown;
    progressPercent?: unknown;
  };
  try {
    payload = (await request.json()) as {
      title?: unknown;
      description?: unknown;
      topicId?: unknown;
      position?: unknown;
      progressPercent?: unknown;
    };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const updates: UpdateLibraryMaterialInput = {};

  if ("title" in payload) {
    const title = normalizeText(payload.title);
    if (!title) {
      return NextResponse.json({ message: "Title must be a non-empty string." }, { status: 422 });
    }
    updates.title = title;
  }

  if ("description" in payload) {
    const description = normalizeText(payload.description);
    if (!description) {
      return NextResponse.json(
        { message: "Description must be a non-empty string." },
        { status: 422 }
      );
    }
    updates.description = description;
  }

  if ("topicId" in payload) {
    const topicId = normalizeText(payload.topicId);
    if (!topicId) {
      return NextResponse.json({ message: "Topic id must be a non-empty string." }, { status: 422 });
    }
    updates.topicId = topicId;
  }

  if ("position" in payload) {
    const position = parseInteger(payload.position);
    if (position === null || position < 1) {
      return NextResponse.json(
        { message: "Position must be an integer greater than or equal to 1." },
        { status: 422 }
      );
    }
    updates.position = position;
  }

  if ("progressPercent" in payload) {
    const progressPercent = parseInteger(payload.progressPercent);
    if (progressPercent === null || progressPercent < 0 || progressPercent > 100) {
      return NextResponse.json(
        { message: "Progress must be an integer between 0 and 100." },
        { status: 422 }
      );
    }
    updates.progressPercent = progressPercent;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "No valid fields provided for update." }, { status: 422 });
  }

  const client = createBackendClient(request);

  try {
    const currentMaterialResult = await client.call(
      `/api/v1/materials/${encodeURIComponent(context.params.materialId)}`,
      { method: "GET" }
    );

    if (!currentMaterialResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        currentMaterialResult.response,
        currentMaterialResult.payload,
        "Material not found."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const currentMaterial = currentMaterialResult.payload as BackendMaterialResponse;
    if (updates.topicId && updates.topicId !== currentMaterial.topic_id) {
      return NextResponse.json(
        { message: "Changing material topic is not supported by backend API." },
        { status: 422 }
      );
    }

    const updateResult = await client.call(
      `/api/v1/materials/${encodeURIComponent(context.params.materialId)}`,
      {
        method: "PUT",
        body: {
          title: updates.title ?? currentMaterial.title,
          description: updates.description ?? currentMaterial.description,
          position: updates.position ?? currentMaterial.position,
          progress: updates.progressPercent ?? currentMaterial.progress
        }
      }
    );

    if (!updateResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        updateResult.response,
        updateResult.payload,
        "Material update failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const updatedMaterialResult = await client.call(
      `/api/v1/materials/${encodeURIComponent(context.params.materialId)}`,
      { method: "GET" }
    );
    if (!updatedMaterialResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        updatedMaterialResult.response,
        updatedMaterialResult.payload,
        "Failed to load updated material."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const topicsResult = await loadTopicTitleMap(client);
    if (topicsResult.errorResponse) {
      client.applyUpdatedSession(topicsResult.errorResponse);
      return topicsResult.errorResponse;
    }

    const material = updatedMaterialResult.payload as BackendMaterialResponse;
    const response = NextResponse.json(
      {
        id: material.id,
        title: material.title,
        description: material.description,
        topicId: material.topic_id,
        topicTitle: topicsResult.topicTitleMap.get(material.topic_id) ?? material.topic_id,
        position: material.position,
        progressPercent: material.progress
      },
      { status: 200 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Materials backend is unavailable.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);

  try {
    const deleteResult = await client.call(
      `/api/v1/materials/${encodeURIComponent(context.params.materialId)}`,
      { method: "DELETE" }
    );

    if (!deleteResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        deleteResult.response,
        deleteResult.payload,
        "Material removal failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json({ success: true }, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Materials backend is unavailable.");
  }
}
