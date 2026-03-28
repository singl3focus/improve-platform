export type TopicWorkspaceStatus = "not_started" | "in_progress" | "paused" | "completed";

export type TopicChecklistStatus = "todo" | "in_progress" | "done";

export interface TopicDependency {
  topicId: string;
  title: string;
  isCompleted: boolean;
  isRequired: boolean;
}

export interface TopicChecklistItem {
  id: string;
  title: string;
  description: string;
  status: TopicChecklistStatus;
}

export interface TopicMaterial {
  id: string;
  title: string;
  description: string;
  position: number;
  progressPercent: number;
}

export interface TopicWorkspace {
  id: string;
  title: string;
  description: string;
  goal: string;
  status: TopicWorkspaceStatus;
  confidence: number | null;
  progressPercent: number;
  startDate: string;
  targetDate: string;
  completedAt: string | null;
  dependencies: TopicDependency[];
  checklist: TopicChecklistItem[];
  materials: TopicMaterial[];
}
