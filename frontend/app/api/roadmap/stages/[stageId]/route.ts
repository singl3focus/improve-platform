import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@/lib/backend-api";
import { normalizeText, parseInteger } from "@/lib/payload-parsers";

interface RouteContext {
  params: {
    stageId: string;
  };
}

interface StageUpdatePayload {
  title?: unknown;
  position?: unknown;
}

function normalizeStageId(stageId: string): string | null {
  const value = stageId.trim();
  return value.length > 0 ? value : null;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  let payload: StageUpdatePayload;
  try {
    payload = (await request.json()) as StageUpdatePayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const title = normalizeText(payload.title);
  if (!title) {
    return NextResponse.json({ message: "Stage title is required." }, { status: 422 });
  }

  const position = parseInteger(payload.position);
  if (position === null || position < 1) {
    return NextResponse.json(
      { message: "Position must be an integer greater than or equal to 1." },
      { status: 422 }
    );
  }

  const stageId = normalizeStageId(context.params.stageId);
  if (!stageId) {
    return NextResponse.json({ message: "Stage id is required." }, { status: 422 });
  }

  const client = createBackendClient(request);

  try {
    const updateResult = await client.call(`/api/v1/roadmap/stages/${encodeURIComponent(stageId)}`, {
      method: "PUT",
      body: {
        title,
        position
      }
    });

    if (!updateResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        updateResult.response,
        updateResult.payload,
        "Roadmap stage update failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(
      {
        id: stageId,
        title,
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
  const stageId = normalizeStageId(context.params.stageId);
  if (!stageId) {
    return NextResponse.json({ message: "Stage id is required." }, { status: 422 });
  }

  const client = createBackendClient(request);

  try {
    const deleteResult = await client.call(`/api/v1/roadmap/stages/${encodeURIComponent(stageId)}`, {
      method: "DELETE"
    });
    if (!deleteResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        deleteResult.response,
        deleteResult.payload,
        "Roadmap stage removal failed."
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
