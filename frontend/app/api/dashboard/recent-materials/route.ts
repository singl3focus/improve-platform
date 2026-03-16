import { NextRequest } from "next/server";
import {
  applyDashboardError,
  createDashboardClient,
  dashboardJson,
  dashboardUnavailableResponse,
  loadMaterials,
  loadRoadmapOrEmpty
} from "../_shared";

function parseTimestamp(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }
  return date.getTime();
}

export async function GET(request: NextRequest) {
  const client = createDashboardClient(request);

  try {
    const roadmapResult = await loadRoadmapOrEmpty(client);
    if (roadmapResult.errorResponse) {
      return applyDashboardError(client, roadmapResult.errorResponse);
    }

    const materialsResult = await loadMaterials(client, roadmapResult.roadmap);
    if (materialsResult.errorResponse) {
      return applyDashboardError(client, materialsResult.errorResponse);
    }

    const payload = materialsResult.materials
      .slice()
      .sort(
        (left, right) =>
          parseTimestamp(right.material.updated_at) - parseTimestamp(left.material.updated_at)
      )
      .map(({ material, topicTitle }) => ({
        id: material.id,
        title: material.title,
        topicTitle,
        progressPercent: material.progress,
        lastOpenedAt: material.updated_at
      }));

    return dashboardJson(client, payload);
  } catch {
    return dashboardUnavailableResponse();
  }
}

