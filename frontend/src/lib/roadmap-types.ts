export type RoadmapTopicStatus = "not_started" | "in_progress" | "paused" | "completed";

export interface RoadmapTopic {
  id: string;
  stageId?: string;
  title: string;
  description: string;
  position: number;
  status: RoadmapTopicStatus;
  progressPercent: number;
  isBlocked: boolean;
  blockedReason: string | null;
  tasksCount: number;
  materialsCount: number;
  prerequisiteTopicIds: string[];
}

export interface RoadmapStage {
  id: string;
  title: string;
  topics: RoadmapTopic[];
}

export interface RoadmapResponse {
  stages?: RoadmapStage[];
  topics?: RoadmapTopic[];
}

export function flattenRoadmapTopics(roadmap: RoadmapResponse): RoadmapTopic[] {
  if (Array.isArray(roadmap.topics)) {
    return roadmap.topics;
  }

  const topics: RoadmapTopic[] = [];
  for (const stage of roadmap.stages ?? []) {
    for (const topic of stage.topics ?? []) {
      topics.push(topic);
    }
  }
  return topics;
}
