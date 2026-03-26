import { NextRequest, NextResponse } from "next/server";
import type {
  BackendMaterialResponse,
  BackendRoadmapResponse
} from "@shared/api/backend-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse,
  isBackendErrorCode
} from "@shared/api/backend-client";
import { normalizeText, parseInteger } from "@shared/api/payload-parsers";
import {
  buildTopicTitleMap,
  extractTopicTitleOptions,
  type TopicTitleOption
} from "@features/roadmap/lib/roadmap-topic-helpers";
import {
  mapBackendMaterialToLibraryMaterial,
  toBackendCreateMaterialPayload
} from "@features/materials/lib/materials-api-mapping";

const ALLOWED_MATERIAL_TYPES = new Set(["book", "article", "course", "video"]);

async function loadRoadmapTopics(
  client: ReturnType<typeof createBackendClient>
): Promise<{
  topics: TopicTitleOption[] | null;
  errorResponse: NextResponse | null;
}> {
  const roadmapResult = await client.call("/api/v1/roadmap", { method: "GET" });
  if (!roadmapResult.response.ok) {
    if (
      roadmapResult.response.status === 404 &&
      isBackendErrorCode(roadmapResult.payload, "roadmap_not_found")
    ) {
      return {
        topics: [],
        errorResponse: null
      };
    }

    return {
      topics: null,
      errorResponse: createBackendErrorResponse(
        roadmapResult.response,
        roadmapResult.payload,
        "Failed to load roadmap topics."
      )
    };
  }

  const roadmap = roadmapResult.payload as BackendRoadmapResponse;
  return {
    topics: extractTopicTitleOptions(roadmap),
    errorResponse: null
  };
}

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);

  try {
    const topicsResult = await loadRoadmapTopics(client);
    if (topicsResult.errorResponse) {
      client.applyUpdatedSession(topicsResult.errorResponse);
      return topicsResult.errorResponse;
    }

    const topics = topicsResult.topics ?? [];
    const topicTitleMap = buildTopicTitleMap(topics);
    const materials: Array<{
      id: string;
      title: string;
      description: string;
      topicId: string;
      topicTitle: string;
      type: "book" | "article" | "course" | "video";
      unit: "pages" | "lessons" | "hours";
      totalAmount: number;
      completedAmount: number;
      position: number;
      progressPercent: number;
    }> = [];

    for (const topic of topics) {
      const materialsResult = await client.call(
        `/api/v1/roadmap/topics/${encodeURIComponent(topic.id)}/materials`,
        { method: "GET" }
      );

      if (!materialsResult.response.ok) {
        if (
          materialsResult.response.status === 404 &&
          isBackendErrorCode(materialsResult.payload, "topic_not_found")
        ) {
          continue;
        }

        const errorResponse = createBackendErrorResponse(
          materialsResult.response,
          materialsResult.payload,
          "Failed to load materials list."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }

      for (const material of (materialsResult.payload as BackendMaterialResponse[]) ?? []) {
        materials.push(
          mapBackendMaterialToLibraryMaterial(
            material,
            topicTitleMap.get(material.topic_id) ?? material.topic_id
          )
        );
      }
    }

    const topicFilter = request.nextUrl.searchParams.get("topicId");
    const queryFilter = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

    const filteredMaterials = materials
      .filter((material) => (topicFilter ? material.topicId === topicFilter : true))
      .filter((material) => {
        if (!queryFilter) {
          return true;
        }

        return (
          material.title.toLowerCase().includes(queryFilter) ||
          material.description.toLowerCase().includes(queryFilter) ||
          material.topicTitle.toLowerCase().includes(queryFilter)
        );
      })
      .sort(
        (left, right) =>
          left.topicTitle.localeCompare(right.topicTitle) ||
          left.position - right.position ||
          left.title.localeCompare(right.title)
      );

    const response = NextResponse.json(
      {
        materials: filteredMaterials,
        topics
      },
      { status: 200 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Materials backend is unavailable.");
  }
}

export async function POST(request: NextRequest) {
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

  const title = normalizeText(payload.title);
  const description = normalizeText(payload.description);
  const topicId = normalizeText(payload.topicId);
  const materialType = normalizeText(payload.type);
  const totalAmount = parseInteger(payload.totalAmount);
  const completedAmount = parseInteger(payload.completedAmount);
  const position = parseInteger(payload.position);

  if (
    !title ||
    !description ||
    !topicId ||
    !materialType ||
    totalAmount === null ||
    completedAmount === null ||
    position === null
  ) {
    return NextResponse.json(
      {
        message:
          "Invalid material payload. Required: title, description, topicId, type, totalAmount, completedAmount, position."
      },
      { status: 422 }
    );
  }

  if (!ALLOWED_MATERIAL_TYPES.has(materialType)) {
    return NextResponse.json(
      { message: "Type must be one of: book, article, course, video." },
      { status: 422 }
    );
  }

  if (position < 1) {
    return NextResponse.json(
      { message: "Position must be an integer greater than or equal to 1." },
      { status: 422 }
    );
  }

  if (totalAmount < 0 || completedAmount < 0 || completedAmount > totalAmount) {
    return NextResponse.json(
      {
        message:
          "totalAmount and completedAmount must be non-negative integers and completedAmount must be <= totalAmount."
      },
      { status: 422 }
    );
  }

  const client = createBackendClient(request);

  try {
    const topicsResult = await loadRoadmapTopics(client);
    if (topicsResult.errorResponse) {
      client.applyUpdatedSession(topicsResult.errorResponse);
      return topicsResult.errorResponse;
    }
    const topicTitleMap = buildTopicTitleMap(topicsResult.topics ?? []);

    const createResult = await client.call("/api/v1/materials", {
      method: "POST",
      body: toBackendCreateMaterialPayload({
        topicId,
        title,
        description,
        type: materialType as "book" | "article" | "course" | "video",
        totalAmount,
        completedAmount,
        position
      })
    });

    if (!createResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        createResult.response,
        createResult.payload,
        "Material creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const material = createResult.payload as BackendMaterialResponse;
    const response = NextResponse.json(
      mapBackendMaterialToLibraryMaterial(
        material,
        topicTitleMap.get(material.topic_id) ?? material.topic_id
      ),
      { status: 201 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Materials backend is unavailable.");
  }
}
