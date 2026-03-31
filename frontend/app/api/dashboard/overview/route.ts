import { NextRequest } from "next/server";
import type {
  BackendHistoryEventResponse,
  BackendRoadmapListItem,
  BackendTaskResponse
} from "@shared/api/backend-contracts";
import { isBackendRoadmapListArray } from "@shared/api/backend-contracts";
import { getStringValue, isRecord } from "@shared/api/backend-shared";
import {
  applyDashboardError,
  buildTopicTitleMap,
  createDashboardClient,
  dashboardJson,
  dashboardUnavailableResponse,
  flattenRoadmapTopics,
  loadMaterials,
  loadRoadmapOrEmpty,
  loadTasks
} from "../_shared";
import type { DashboardOverviewResponse } from "@features/dashboard/types";
import type { RoadmapListItem } from "@features/roadmap/types";
import { createBackendErrorResponse } from "@shared/api/backend-client";
import { mapWithConcurrency } from "@shared/lib/map-with-concurrency";

interface BackendFocusTask {
  id: string;
  title: string;
  topic_id: string | null;
  topic_title: string | null;
  status: string;
  deadline: string | null;
  priority_level: string;
}

interface BackendFocusTopic {
  id: string;
  title: string;
  last_task_title: string;
  progress_percent: number;
}

interface BackendFocusResponse {
  primary_task: BackendFocusTask | null;
  secondary_tasks: BackendFocusTask[];
  continue_topic: BackendFocusTopic | null;
}

interface BackendActivityDay {
  date: string;
  count: number;
}

interface BackendActivityHeatmap {
  days: BackendActivityDay[];
  streak: number;
  total_active_days: number;
}

const OVERVIEW_BACKEND_TIMEOUT_MS = 8_000;
const OVERVIEW_TOPICS_CONCURRENCY = 6;

function mapFocusTask(task: BackendFocusTask) {
  return {
    id: task.id,
    title: task.title,
    topicId: task.topic_id,
    topicTitle: task.topic_title,
    status: task.status,
    deadline: task.deadline,
    priorityLevel: task.priority_level as "overdue" | "due_today" | "in_progress" | "active_topic"
  };
}

function mapFocusResponse(raw: BackendFocusResponse) {
  return {
    primaryTask: raw.primary_task ? mapFocusTask(raw.primary_task) : null,
    secondaryTasks: (raw.secondary_tasks ?? []).map(mapFocusTask),
    continueTopic: raw.continue_topic
      ? {
          id: raw.continue_topic.id,
          title: raw.continue_topic.title,
          lastTaskTitle: raw.continue_topic.last_task_title,
          progressPercent: raw.continue_topic.progress_percent
        }
      : null
  };
}

function mapRoadmapList(value: unknown): RoadmapListItem[] {
  if (!isBackendRoadmapListArray(value)) {
    return [];
  }

  return value.map((item: BackendRoadmapListItem) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    totalTopics: item.total_topics,
    completedTopics: item.completed_topics,
    progressPercent: item.progress_percent,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }));
}

function mapSessionResponse(payload: unknown) {
  const record = isRecord(payload) ? payload : null;
  return {
    authenticated: true,
    user: record
      ? {
          id: getStringValue(record, "id"),
          email: getStringValue(record, "email"),
          full_name: getStringValue(record, "full_name") ?? getStringValue(record, "fullName")
        }
      : undefined
  };
}

function mapHeatmapResponse(raw: BackendActivityHeatmap) {
  return {
    days: (raw.days ?? []).map((day) => ({
      date: day.date,
      count: day.count
    })),
    streak: raw.streak ?? 0,
    totalActiveDays: raw.total_active_days ?? 0
  };
}

function mapHistoryEvents(events: BackendHistoryEventResponse[]) {
  return events.map((event) => ({
    id: event.id,
    entityType: event.entity_type,
    entityId: event.entity_id,
    eventType: event.event_type,
    eventName: event.event_name,
    payload: event.payload ?? {},
    createdAt: event.created_at
  }));
}

function parseDeadline(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime();
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  const client = createDashboardClient(request);

  try {
    const [sessionResult, focusResult, roadmapListResult, historyResult, heatmapResult] =
      await Promise.all([
        client.call("/api/v1/me", {
          method: "GET",
          signal: request.signal,
          timeoutMs: OVERVIEW_BACKEND_TIMEOUT_MS
        }),
        client.call("/api/v1/dashboard/focus", {
          method: "GET",
          signal: request.signal,
          timeoutMs: OVERVIEW_BACKEND_TIMEOUT_MS
        }),
        client.call("/api/v1/roadmaps", {
          method: "GET",
          signal: request.signal,
          timeoutMs: OVERVIEW_BACKEND_TIMEOUT_MS
        }),
        client.call("/api/v1/history?limit=6&offset=0", {
          method: "GET",
          signal: request.signal,
          timeoutMs: OVERVIEW_BACKEND_TIMEOUT_MS
        }),
        client.call("/api/v1/dashboard/activity-heatmap", {
          method: "GET",
          signal: request.signal,
          timeoutMs: OVERVIEW_BACKEND_TIMEOUT_MS
        })
      ]);

    if (!sessionResult.response.ok) {
      return applyDashboardError(
        client,
        createBackendErrorResponse(sessionResult.response, sessionResult.payload, "Failed to load session.")
      );
    }

    if (!focusResult.response.ok) {
      return applyDashboardError(
        client,
        createBackendErrorResponse(focusResult.response, focusResult.payload, "Failed to load focus data.")
      );
    }

    if (!roadmapListResult.response.ok) {
      return applyDashboardError(
        client,
        createBackendErrorResponse(roadmapListResult.response, roadmapListResult.payload, "Failed to load roadmaps.")
      );
    }

    if (!historyResult.response.ok) {
      return applyDashboardError(
        client,
        createBackendErrorResponse(historyResult.response, historyResult.payload, "Failed to load history.")
      );
    }

    if (!heatmapResult.response.ok) {
      return applyDashboardError(
        client,
        createBackendErrorResponse(
          heatmapResult.response,
          heatmapResult.payload,
          "Failed to load activity heatmap."
        )
      );
    }

    const roadmapResult = await loadRoadmapOrEmpty(client, { signal: request.signal });
    if (roadmapResult.errorResponse) {
      return applyDashboardError(client, roadmapResult.errorResponse);
    }

    const tasksResult = await loadTasks(client, { signal: request.signal });
    if (tasksResult.errorResponse) {
      return applyDashboardError(client, tasksResult.errorResponse);
    }

    const materialsResult = await loadMaterials(client, roadmapResult.roadmap, { signal: request.signal });
    if (materialsResult.errorResponse) {
      return applyDashboardError(client, materialsResult.errorResponse);
    }

    const roadmap = roadmapResult.roadmap;
    const tasks = tasksResult.tasks ?? [];
    const topics = flattenRoadmapTopics(roadmap);
    const topicTitleMap = buildTopicTitleMap(roadmap);
    const totalTopics = topics.length;
    const completedTopics = topics.filter((topic) => topic.status === "completed").length;
    const roadmapProgressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    const focusHoursCompleted = tasks.filter((task) => task.status === "done").length;
    const focusHoursTarget = tasks.length;
    const now = Date.now();

    const upcomingTasks = tasks
      .filter((task) => task.status !== "done")
      .map((task) => ({
        task,
        timestamp: parseDeadline(task.deadline)
      }))
      .filter((entry) => entry.timestamp !== null && entry.timestamp >= now)
      .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));

    const topicsInProgress = await mapWithConcurrency(
      topics.filter((topic) => topic.status === "in_progress"),
      async (topic) => {
        const topicTasksResult = await client.call(
          `/api/v1/roadmap/topics/${encodeURIComponent(topic.id)}/tasks`,
          {
            method: "GET",
            signal: request.signal,
            timeoutMs: OVERVIEW_BACKEND_TIMEOUT_MS
          }
        );

        if (!topicTasksResult.response.ok) {
          return {
            id: topic.id,
            title: topic.title,
            progressPercent: 0,
            targetDate: topic.target_date ?? ""
          };
        }

        const payload = topicTasksResult.payload as { percent?: number };
        return {
          id: topic.id,
          title: topic.title,
          progressPercent: payload.percent ?? 0,
          targetDate: topic.target_date ?? ""
        };
      },
      {
        concurrency: OVERVIEW_TOPICS_CONCURRENCY,
        signal: request.signal
      }
    );

    const dayStart = startOfDay(new Date());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 6);
    dayEnd.setHours(23, 59, 59, 999);
    const deadlinesByDay = new Map<string, number>();
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(dayStart);
      day.setDate(day.getDate() + offset);
      deadlinesByDay.set(toDayKey(day), 0);
    }

    for (const task of tasks as BackendTaskResponse[]) {
      if (task.status === "done" || !task.deadline) {
        continue;
      }

      const deadline = new Date(task.deadline);
      if (Number.isNaN(deadline.getTime()) || deadline < dayStart || deadline > dayEnd) {
        continue;
      }

      const key = toDayKey(deadline);
      deadlinesByDay.set(key, (deadlinesByDay.get(key) ?? 0) + 1);
    }

    const payload: DashboardOverviewResponse = {
      session: mapSessionResponse(sessionResult.payload),
      focus: mapFocusResponse(focusResult.payload as BackendFocusResponse),
      progress: {
        roadmapProgressPercent,
        completedTopics,
        totalTopics,
        focusHoursCompleted,
        focusHoursTarget
      },
      roadmapList: mapRoadmapList(roadmapListResult.payload),
      dailySummary: {
        nextTaskTitle: upcomingTasks[0]?.task.title ?? null,
        upcomingTasksCount: upcomingTasks.length
      },
      topicsInProgress,
      upcomingTasks: upcomingTasks.map(({ task }) => ({
        id: task.id,
        title: task.title,
        topicTitle: task.topic_id ? (topicTitleMap.get(task.topic_id) ?? undefined) : undefined,
        dueAt: task.deadline ?? ""
      })),
      charts: {
        topicsByStatus: {
          notStarted: topics.filter((topic) => topic.status === "not_started").length,
          inProgress: topics.filter((topic) => topic.status === "in_progress").length,
          paused: topics.filter((topic) => topic.status === "paused").length,
          completed: topics.filter((topic) => topic.status === "completed").length
        },
        upcomingDeadlines: Array.from(deadlinesByDay.entries()).map(([date, count]) => ({
          date,
          count
        }))
      },
      recentMaterials: materialsResult.materials
        .slice()
        .sort(
          (left, right) =>
            new Date(right.material.updated_at).getTime() - new Date(left.material.updated_at).getTime()
        )
        .map(({ material, topicTitle }) => ({
          id: material.id,
          title: material.title,
          topicTitle,
          progressPercent: material.progress,
          lastOpenedAt: material.updated_at
        })),
      history: mapHistoryEvents((historyResult.payload as BackendHistoryEventResponse[]) ?? []),
      heatmap: mapHeatmapResponse(heatmapResult.payload as BackendActivityHeatmap)
    };

    return dashboardJson(client, payload);
  } catch {
    return dashboardUnavailableResponse();
  }
}
