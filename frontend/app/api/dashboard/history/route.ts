import { NextRequest } from "next/server";
import type { BackendHistoryEventResponse } from "@/lib/backend-learning-contracts";
import { createBackendErrorResponse } from "@/lib/backend-api";
import {
  applyDashboardError,
  createDashboardClient,
  dashboardJson,
  dashboardUnavailableResponse
} from "../_shared";

function parseLimit(rawValue: string | null): number {
  if (!rawValue) {
    return 10;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }

  return Math.min(parsed, 100);
}

export async function GET(request: NextRequest) {
  const client = createDashboardClient(request);

  try {
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const result = await client.call(`/api/v1/history?limit=${limit}&offset=0`, { method: "GET" });

    if (!result.response.ok) {
      return applyDashboardError(
        client,
        createBackendErrorResponse(result.response, result.payload, "Failed to load history.")
      );
    }

    const payload = ((result.payload as BackendHistoryEventResponse[]) ?? []).map((event) => ({
      id: event.id,
      entityType: event.entity_type,
      entityId: event.entity_id,
      eventType: event.event_type,
      eventName: event.event_name,
      payload: event.payload ?? {},
      createdAt: event.created_at
    }));

    return dashboardJson(client, payload);
  } catch {
    return dashboardUnavailableResponse();
  }
}
