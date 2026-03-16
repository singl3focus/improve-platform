export type RoadmapTopicStatus = "not_started" | "in_progress" | "paused" | "completed";

export interface RoadmapTopic {
  id: string;
  stageId: string;
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
  stages: RoadmapStage[];
}
