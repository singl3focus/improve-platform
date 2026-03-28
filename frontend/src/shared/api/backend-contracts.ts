export interface BackendRoadmapTopic {
  id: string;
  roadmap_id: string;
  stage_id: string;
  title: string;
  description: string;
  goal: string;
  position: number;
  status: "not_started" | "in_progress" | "paused" | "completed";
  confidence: number | null;
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
  dependencies: string[];
}

export interface BackendRoadmapListItem {
  id: string;
  title: string;
  total_topics: number;
  completed_topics: number;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface BackendRoadmapStage {
  id: string;
  title: string;
  position: number;
  topics: BackendRoadmapTopic[];
}

export interface BackendRoadmapResponse {
  id: string;
  title: string;
  stages: BackendRoadmapStage[];
}

export interface BackendTaskResponse {
  id: string;
  topic_id: string | null;
  title: string;
  description: string;
  status: "new" | "in_progress" | "paused" | "done";
  deadline: string | null;
  position: number;
  is_overdue: boolean;
}

export interface BackendTopicTasksResponse {
  topic_id: string;
  total: number;
  done: number;
  percent: number;
  tasks: BackendTaskResponse[];
}

export interface BackendMaterialResponse {
  id: string;
  topic_id: string;
  title: string;
  description: string;
  url?: string;
  type: "book" | "article" | "course" | "video";
  unit: "pages" | "lessons" | "hours";
  total_amount: number;
  completed_amount: number;
  progress: number;
  position: number;
  updated_at: string;
}

// ── Type guards ──

export function isBackendRoadmapResponse(value: unknown): value is BackendRoadmapResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && Array.isArray(obj.stages);
}

export function isBackendTopicTasksResponse(value: unknown): value is BackendTopicTasksResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.topic_id === "string" && typeof obj.total === "number" && Array.isArray(obj.tasks);
}

export function isBackendRoadmapListArray(value: unknown): value is BackendRoadmapListItem[] {
  return Array.isArray(value) && value.every(
    (item) => typeof item === "object" && item !== null && "id" in item && typeof (item as Record<string, unknown>).id === "string"
  );
}

export interface BackendHistoryEventResponse {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  event_name: string;
  payload: Record<string, unknown>;
  created_at: string;
}
