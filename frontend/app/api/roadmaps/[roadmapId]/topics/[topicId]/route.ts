import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface RouteContext {
  params: {
    roadmapId: string;
    topicId: string;
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const { roadmapId, topicId } = context.params;

  try {
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}`,
      { method: "GET" }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load topic."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(result.payload, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const { roadmapId, topicId } = context.params;

  try {
    const body = await request.json();

    // If the request includes a status change, handle it via the dedicated
    // status endpoint first — the backend PUT does not update status.
    if (typeof body.status === "string" && body.status) {
      const statusResult = await client.call(
        `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}/status`,
        {
          method: "PATCH",
          body: { status: body.status }
        }
      );

      if (!statusResult.response.ok) {
        const errorResponse = createBackendErrorResponse(
          statusResult.response,
          statusResult.payload,
          "Topic status update failed."
        );
        client.applyUpdatedSession(errorResponse);
        return errorResponse;
      }
    }

    // Forward the remaining fields to the topic update endpoint.
    const { status: _status, ...topicFields } = body;
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}`,
      {
        method: "PUT",
        body: topicFields
      }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Topic update failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = new NextResponse(null, { status: 204 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const client = createBackendClient(request);
  const { roadmapId, topicId } = context.params;

  try {
    const result = await client.call(
      `/api/v1/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}`,
      { method: "DELETE" }
    );

    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Topic deletion failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = new NextResponse(null, { status: 204 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
