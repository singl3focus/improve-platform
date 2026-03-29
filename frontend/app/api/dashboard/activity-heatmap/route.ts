import { NextRequest, NextResponse } from "next/server";
import {
  createBackendClient,
  createBackendErrorResponse,
  createBackendUnavailableResponse
} from "@shared/api/backend-client";

interface BackendActivityDay {
  date: string;
  count: number;
}

interface BackendActivityHeatmap {
  days: BackendActivityDay[];
  streak: number;
  total_active_days: number;
}

function mapResponse(raw: BackendActivityHeatmap) {
  return {
    days: (raw.days ?? []).map((d) => ({ date: d.date, count: d.count })),
    streak: raw.streak,
    totalActiveDays: raw.total_active_days
  };
}

export async function GET(request: NextRequest) {
  const client = createBackendClient(request);
  try {
    const result = await client.call("/api/v1/dashboard/activity-heatmap", { method: "GET" });
    if (!result.response.ok) {
      const errorResponse = createBackendErrorResponse(
        result.response,
        result.payload,
        "Failed to load activity heatmap."
      );
      client.applyUpdatedSession(errorResponse);
      return errorResponse;
    }
    const mapped = mapResponse(result.payload as BackendActivityHeatmap);
    const response = NextResponse.json(mapped, { status: 200 });
    client.applyUpdatedSession(response);
    return response;
  } catch {
    return createBackendUnavailableResponse("Heatmap backend is unavailable.");
  }
}
