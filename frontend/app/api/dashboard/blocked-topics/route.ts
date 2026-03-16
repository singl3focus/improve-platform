import { NextRequest } from "next/server";
import {
  applyDashboardError,
  createDashboardClient,
  dashboardJson,
  dashboardUnavailableResponse,
  flattenRoadmapTopics,
  loadRoadmapOrEmpty
} from "../_shared";

export async function GET(request: NextRequest) {
  const client = createDashboardClient(request);

  try {
    const roadmapResult = await loadRoadmapOrEmpty(client);
    if (roadmapResult.errorResponse) {
      return applyDashboardError(client, roadmapResult.errorResponse);
    }

    const payload = flattenRoadmapTopics(roadmapResult.roadmap)
      .filter((topic) => topic.is_blocked)
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        blockedReason:
          topic.block_reasons && topic.block_reasons.length > 0
            ? topic.block_reasons.join(". ")
            : "Blocked by unresolved dependencies."
      }));

    return dashboardJson(client, payload);
  } catch {
    return dashboardUnavailableResponse();
  }
}

