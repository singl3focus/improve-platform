import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);

  try {
    const result = await client.call("/api/v1/roadmaps", { method: "GET" });

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load roadmaps."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(result.payload, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmaps backend is unavailable.");
  }
}

export async function POST(request: NextRequest) {
  const client = createBackendClient(request);

  try {
    const body = await request.json();
    const result = await client.call("/api/v1/roadmaps", {
      method: "POST",
      body
    });

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Roadmap creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(result.payload, { status: 201 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmaps backend is unavailable.");
  }
}
