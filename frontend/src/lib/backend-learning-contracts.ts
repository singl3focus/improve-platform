export interface BackendRoadmapTopic {
  id: string;
  stage_id: string;
  title: string;
  description: string;
  position: number;
  status: "not_started" | "in_progress" | "paused" | "completed";
  start_date: string | null;
  target_date: string | null;
  completed_date: string | null;
  dependencies: string[];
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
  type: "book" | "article" | "course" | "video";
  unit: "pages" | "lessons" | "hours";
  total_amount: number;
  completed_amount: number;
  progress: number;
  position: number;
  updated_at: string;
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
