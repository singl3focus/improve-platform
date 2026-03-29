export type RoadmapType = "graph" | "levels" | "cycles";

export type RoadmapTopicStatus = "not_started" | "in_progress" | "paused" | "completed";

export interface RoadmapListItem {
  id: string;
  title: string;
  type: RoadmapType;
  totalTopics: number;
  completedTopics: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapTopic {
  id: string;
  roadmapId?: string;
  stageId?: string;
  title: string;
  description: string;
  goal: string;
  position: number;
  status: RoadmapTopicStatus;
  confidence: number | null;
  progressPercent: number;
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
  id?: string;
  title?: string;
  type?: RoadmapType;
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
