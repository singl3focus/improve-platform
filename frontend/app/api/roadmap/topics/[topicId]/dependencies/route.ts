import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";
import { normalizeText } from "@shared/api/payload-parsers";

interface RouteContext {
  params: {
    topicId: string;
  };
}

interface DependencyCreatePayload {
  prerequisiteTopicId?: unknown;
}

export async function POST(request: NextRequest, context: RouteContext) {
  let payload: DependencyCreatePayload;
  try {
    payload = (await request.json()) as DependencyCreatePayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const prerequisiteTopicId = normalizeText(payload.prerequisiteTopicId);
  if (!prerequisiteTopicId) {
    return NextResponse.json({ message: "Prerequisite topic id is required." }, { status: 422 });
  }

  const client = createBackendClient(request);
  const topicId = context.params.topicId;

  try {
    const addResult = await client.call(
      `/api/v1/roadmap/topics/${encodeURIComponent(topicId)}/dependencies`,
      {
        method: "POST",
        body: {
          depends_on_topic_id: prerequisiteTopicId
        }
      }
    );

    if (!addResult.response.ok) {
      const errorResponse = createBackendErrorResponse(
        addResult.response,
        addResult.payload,
        "Roadmap dependency creation failed."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }

    const response = NextResponse.json(
      {
        success: true,
        topicId,
        prerequisiteTopicId
      },
      { status: 201 }
    );
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Roadmap backend is unavailable.");
  }
}
