"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@features/auth/lib/auth-fetch";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import type {
  DashboardChartsPayload,
  DashboardDailySummary,
  DashboardFocus,
  DashboardHistoryEvent,
  DashboardProgress,
  DashboardRecentMaterial,
  DashboardTask,
  DashboardTopicInProgress
} from "@features/dashboard/types";
import type { DashboardCopy } from "@shared/i18n/ui-copy";
import type { BackendRoadmapListItem } from "@shared/api/backend-contracts";
import type { RoadmapListItem } from "@features/roadmap/types";

export type DashboardLoadStatus = "loading" | "success" | "error";

export interface DashboardResourceState<T> {
  status: DashboardLoadStatus;
  data: T | null;
  errorMessage: string | null;
}

interface DashboardSessionResponse {
  authenticated: boolean;
  user?: {
    full_name?: string;
  };
}

function initialResourceState<T>(): DashboardResourceState<T> {
  return {
    status: "loading",
    data: null,
    errorMessage: null
  };
}

async function fetchDashboardResource<T>(
  endpoint: string,
  signal: AbortSignal,
  copy: DashboardCopy
): Promise<T> {
  const response = await authFetch(endpoint, {
    method: "GET",
    signal
  });

  if (!response.ok) {
    let message = copy.requestFailed(response.status);
    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload?.message === "string") {
        message = payload.message;
      }
    } catch {
      // Ignore parse errors for non-JSON responses.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function useDashboardResource<T>(endpoint: string, copy: DashboardCopy) {
  const [state, setState] = useState<DashboardResourceState<T>>(initialResourceState<T>());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState(initialResourceState<T>());
      try {
        const payload = await fetchDashboardResource<T>(endpoint, controller.signal, copy);
        setState({
          status: "success",
          data: payload,
          errorMessage: null
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          data: null,
          errorMessage: error instanceof Error ? error.message : copy.blockLoadFailed
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [copy, endpoint, reloadKey]);

  return {
    state,
    reload: () => setReloadKey((current) => current + 1)
  };
}

function formatTodayDate(locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date());
}

export function formatDashboardDate(value: string, locale: string, noDateLabel: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return noDateLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function isDashboardTaskOverdue(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.getTime() < Date.now();
}

export function hasDailySummaryContent(data: DashboardDailySummary): boolean {
  return data.upcomingTasksCount > 0 || data.nextTaskTitle !== null;
}

export function hasRoadmapProgress(data: DashboardProgress): boolean {
  return data.totalTopics > 0;
}

function useRoadmapList(copy: DashboardCopy) {
  const [state, setState] = useState<DashboardResourceState<RoadmapListItem[]>>(
    initialResourceState<RoadmapListItem[]>()
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState(initialResourceState<RoadmapListItem[]>());
      try {
        const response = await authFetch("/api/roadmaps", {
          method: "GET",
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(copy.blockLoadFailed);
        }
        const raw = (await response.json()) as BackendRoadmapListItem[];
        const mapped: RoadmapListItem[] = raw.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          totalTopics: r.total_topics,
          completedTopics: r.completed_topics,
          progressPercent: r.progress_percent,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
        setState({ status: "success", data: mapped, errorMessage: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          errorMessage: error instanceof Error ? error.message : copy.blockLoadFailed
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [copy]);

  return { state };
}

export function useDashboardViewModel() {
  const { language, copy } = useUserPreferences();
  const dashboardCopy = copy.dashboard;
  const locale = language === "ru" ? "ru-RU" : "en-US";

  const session = useDashboardResource<DashboardSessionResponse>("/api/auth/session", dashboardCopy);
  const focus = useDashboardResource<DashboardFocus>("/api/dashboard/focus", dashboardCopy);
  const progress = useDashboardResource<DashboardProgress>("/api/dashboard/progress", dashboardCopy);
  const roadmapList = useRoadmapList(dashboardCopy);
  const dailySummary = useDashboardResource<DashboardDailySummary>(
    "/api/dashboard/daily-summary",
    dashboardCopy
  );
  const topicsInProgress = useDashboardResource<DashboardTopicInProgress[]>(
    "/api/dashboard/in-progress-topics",
    dashboardCopy
  );
  const upcomingTasks = useDashboardResource<DashboardTask[]>(
    "/api/dashboard/upcoming-tasks",
    dashboardCopy
  );
  const charts = useDashboardResource<DashboardChartsPayload>("/api/dashboard/charts", dashboardCopy);
  const recentMaterials = useDashboardResource<DashboardRecentMaterial[]>(
    "/api/dashboard/recent-materials",
    dashboardCopy
  );
  const history = useDashboardResource<DashboardHistoryEvent[]>(
    "/api/dashboard/history?limit=6",
    dashboardCopy
  );

  const roadmapProgressLabel = useMemo(() => {
    if (progress.state.status !== "success" || !progress.state.data) {
      return dashboardCopy.roadmapProgressLoading;
    }

    const data = progress.state.data;
    if (!hasRoadmapProgress(data)) {
      return dashboardCopy.roadmapProgressEmpty;
    }

    return dashboardCopy.roadmapProgressLabel(
      data.roadmapProgressPercent,
      data.completedTopics,
      data.totalTopics
    );
  }, [dashboardCopy, progress.state]);

  const greetingLabel = useMemo(() => {
    const fullName = session.state.data?.user?.full_name?.trim();
    if (fullName && fullName.length > 0) {
      return dashboardCopy.greetingWithName(fullName);
    }

    return dashboardCopy.greetingDefault;
  }, [dashboardCopy, session.state.data]);

  const todayLabel = useMemo(() => dashboardCopy.today(formatTodayDate(locale)), [dashboardCopy, locale]);

  return {
    dashboardCopy,
    language,
    locale,
    session,
    focus,
    progress,
    roadmapList,
    dailySummary,
    topicsInProgress,
    upcomingTasks,
    charts,
    recentMaterials,
    history,
    roadmapProgressLabel,
    greetingLabel,
    todayLabel
  };
}
