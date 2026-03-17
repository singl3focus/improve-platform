import type { BackendRoadmapResponse } from "@/lib/backend-learning-contracts";

export interface TopicTitleOption {
  id: string;
  title: string;
}

type FlatRoadmapTopic = {
  id: string;
  title: string;
};

function extractRoadmapTopics(roadmap: BackendRoadmapResponse): FlatRoadmapTopic[] {
  if (Array.isArray((roadmap as { topics?: unknown }).topics)) {
    return (roadmap as unknown as { topics: FlatRoadmapTopic[] }).topics;
  }

  const topics: FlatRoadmapTopic[] = [];
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

export function extractTopicTitleOptions(roadmap: BackendRoadmapResponse | null): TopicTitleOption[] {
  if (!roadmap) {
    return [];
  }

  return extractRoadmapTopics(roadmap).map((topic) => ({
    id: topic.id,
    title: topic.title
  }));
}

export function buildTopicTitleMap(topics: TopicTitleOption[]): Map<string, string> {
  return new Map(topics.map((topic) => [topic.id, topic.title]));
}

export function buildRoadmapTopicTitleMap(roadmap: BackendRoadmapResponse | null): Map<string, string> {
  return buildTopicTitleMap(extractTopicTitleOptions(roadmap));
}
