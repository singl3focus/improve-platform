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
  is_blocked: boolean;
  block_reasons: string[];
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
  progress: number;
  position: number;
  updated_at: string;
}
