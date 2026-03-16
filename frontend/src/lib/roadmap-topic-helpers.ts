import type { BackendRoadmapResponse } from "@/lib/backend-learning-contracts";

export interface TopicTitleOption {
  id: string;
  title: string;
}

export function extractTopicTitleOptions(roadmap: BackendRoadmapResponse | null): TopicTitleOption[] {
  if (!roadmap) {
    return [];
  }

  const topics: TopicTitleOption[] = [];
  for (const stage of roadmap.stages ?? []) {
    for (const topic of stage.topics ?? []) {
      topics.push({
        id: topic.id,
        title: topic.title
      });
    }
  }

  return topics;
}

export function buildTopicTitleMap(topics: TopicTitleOption[]): Map<string, string> {
  return new Map(topics.map((topic) => [topic.id, topic.title]));
}

export function buildRoadmapTopicTitleMap(roadmap: BackendRoadmapResponse | null): Map<string, string> {
  return buildTopicTitleMap(extractTopicTitleOptions(roadmap));
}
