import { NextRequest, NextResponse } from "next/server";
import type { BackendRoadmapResponse } from "@shared/api/backend-contracts";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";
import { normalizeText, parseInteger } from "@shared/api/payload-parsers";

interface StageCreatePayload {
  title?: unknown;
  position?: unknown;
}

function normalizeStageTitle(value: unknown): string | null {
  return normalizeText(value);
}

function getNextStagePosition(roadmap: BackendRoadmapResponse): number {
  return (roadmap.stages?.length ?? 0) + 1;
}

export async function POST(request: NextRequest) {
  let payload: StageCreatePayload;
  try {
    payload = (await request.json()) as StageCreatePayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const title = normalizeStageTitle(payload.title);
  if (!title) {
    return NextResponse.json({ message: "Stage title is required." }, { status: 422 });
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

  const client = createBackendClient(request);

  try {
    let resolvedPosition = position;
    if (resolvedPosition === null) {
      const listResult = await client.call("/api/v1/roadmaps", { method: "GET" });
      if (!listResult.response.ok) {
        const errorResponse = createBackendErrorResponse(
          listResult.response,
          listResult.payload,
          "Roadmap load failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }

      const roadmapList = listResult.payload as Array<{ id: string }>;
      if (roadmapList.length > 0) {
        const rmResult = await client.call(`/api/v1/roadmaps/${encodeURIComponent(roadmapList[0].id)}`, { method: "GET" });
        if (rmResult.response.ok) {
          const roadmap = rmResult.payload as BackendRoadmapResponse;
          resolvedPosition = getNextStagePosition(roadmap);
        } else {
          resolvedPosition = 1;
        }
      } else {
        resolvedPosition = 1;
      }
    }

    const createResult = await client.call("/api/v1/roadmap/stages", {
      method: "POST",
      body: {
        title,
        position: resolvedPosition
      }
    });

    if (!createResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        createResult.response,
        createResult.payload,
        "Roadmap stage creation failed."
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
