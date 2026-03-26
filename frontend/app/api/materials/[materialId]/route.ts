import { NextRequest, NextResponse } from "next/server";
import type {
  BackendMaterialResponse,
  BackendRoadmapResponse
} from "@shared/api/backend-contracts";
import type { UpdateLibraryMaterialInput } from "@features/materials/types";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@shared/api/backend-client";
import { normalizeText, parseInteger } from "@shared/api/payload-parsers";
import { buildRoadmapTopicTitleMap } from "@features/roadmap/lib/roadmap-topic-helpers";
import {
  mapBackendMaterialToLibraryMaterial,
  toBackendUpdateMaterialPayload
} from "@features/materials/lib/materials-api-mapping";

const ALLOWED_MATERIAL_TYPES = new Set(["book", "article", "course", "video"]);

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
    type?: unknown;
    totalAmount?: unknown;
    completedAmount?: unknown;
    position?: unknown;
  };
  try {
    payload = (await request.json()) as {
      title?: unknown;
      description?: unknown;
      topicId?: unknown;
      type?: unknown;
      totalAmount?: unknown;
      completedAmount?: unknown;
      position?: unknown;
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

  if ("type" in payload) {
    const materialType = normalizeText(payload.type);
    if (!materialType || !ALLOWED_MATERIAL_TYPES.has(materialType)) {
      return NextResponse.json(
        { message: "Type must be one of: book, article, course, video." },
        { status: 422 }
      );
    }
    updates.type = materialType as "book" | "article" | "course" | "video";
  }

  if ("totalAmount" in payload) {
    const totalAmount = parseInteger(payload.totalAmount);
    if (totalAmount === null || totalAmount < 0) {
      return NextResponse.json(
        { message: "totalAmount must be a non-negative integer." },
        { status: 422 }
      );
    }
    updates.totalAmount = totalAmount;
  }

  if ("completedAmount" in payload) {
    const completedAmount = parseInteger(payload.completedAmount);
    if (completedAmount === null || completedAmount < 0) {
      return NextResponse.json(
        { message: "completedAmount must be a non-negative integer." },
        { status: 422 }
      );
    }
    updates.completedAmount = completedAmount;
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
    const nextTotalAmount = updates.totalAmount ?? currentMaterial.total_amount;
    const nextCompletedAmount = updates.completedAmount ?? currentMaterial.completed_amount;
    if (nextCompletedAmount > nextTotalAmount) {
      return NextResponse.json(
        {
          message:
            "totalAmount and completedAmount must be non-negative integers and completedAmount must be <= totalAmount."
        },
        { status: 422 }
      );
    }

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
        body: toBackendUpdateMaterialPayload({
          title: updates.title ?? currentMaterial.title,
          description: updates.description ?? currentMaterial.description,
          type: updates.type ?? currentMaterial.type,
          totalAmount: nextTotalAmount,
          completedAmount: nextCompletedAmount,
          position: updates.position ?? currentMaterial.position
        })
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
      mapBackendMaterialToLibraryMaterial(
        material,
        topicsResult.topicTitleMap.get(material.topic_id) ?? material.topic_id
      ),
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
