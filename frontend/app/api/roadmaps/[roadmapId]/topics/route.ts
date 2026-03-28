import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface RouteContext {
  params: {
    roadmapId: string;
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const roadmapId = context.params.roadmapId;

  try {
    const body = await request.json();
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics`,
      {
        method: "POST",
        body
      }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Topic creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(result.payload, { status: 201 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
