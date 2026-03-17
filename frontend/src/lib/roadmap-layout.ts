import { flattenRoadmapTopics, type RoadmapResponse } from "./roadmap-types";
import type { GraphSize, RoadmapConnection } from "@/lib/roadmap-graph";

export interface TopicRectLike {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

export function buildRoadmapConnections(
  roadmap: RoadmapResponse,
  containerRect: Pick<TopicRectLike, "left" | "top">,
  topicRects: ReadonlyMap<string, TopicRectLike>
): RoadmapConnection[] {
  const connections: RoadmapConnection[] = [];

  for (const topic of flattenRoadmapTopics(roadmap)) {
    const toRect = topicRects.get(topic.id);
    if (!toRect) {
      continue;
    }

    for (const prerequisiteTopicId of topic.prerequisiteTopicIds) {
      const fromRect = topicRects.get(prerequisiteTopicId);
      if (!fromRect) {
        continue;
      }

      connections.push({
        fromId: prerequisiteTopicId,
        toId: topic.id,
        x1: fromRect.left + fromRect.width / 2 - containerRect.left,
        y1: fromRect.bottom - containerRect.top,
        x2: toRect.left + toRect.width / 2 - containerRect.left,
        y2: toRect.top - containerRect.top
      });
    }
  }

  return connections;
}

export function readGraphSize(
  element: Pick<HTMLElement, "clientWidth" | "clientHeight">
): GraphSize {
  return {
    width: Math.max(element.clientWidth, 1),
    height: Math.max(element.clientHeight, 1)
  };
}
