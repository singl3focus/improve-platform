"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@features/auth/lib/auth-fetch";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import type { DashboardDailySummary, DashboardOverviewResponse, DashboardProgress } from "@features/dashboard/types";

export const DASHBOARD_OVERVIEW_QUERY_KEY = ["dashboard-overview"] as const;

async function fetchDashboardOverview(signal?: AbortSignal): Promise<DashboardOverviewResponse> {
  const response = await authFetch("/api/dashboard/overview", {
    method: "GET",
    signal
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
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

  return (await response.json()) as DashboardOverviewResponse;
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

export function useDashboardViewModel() {
  const { language, copy } = useUserPreferences();
  const dashboardCopy = copy.dashboard;
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const overviewQuery = useQuery({
    queryKey: DASHBOARD_OVERVIEW_QUERY_KEY,
    queryFn: ({ signal }) => fetchDashboardOverview(signal),
    staleTime: 60 * 1000,
    retry: false
  });

  const roadmapProgressLabel = useMemo(() => {
    const progress = overviewQuery.data?.progress;
    if (!progress) {
      return dashboardCopy.roadmapProgressLoading;
    }

    if (!hasRoadmapProgress(progress)) {
      return dashboardCopy.roadmapProgressEmpty;
    }

    return dashboardCopy.roadmapProgressLabel(
      progress.roadmapProgressPercent,
      progress.completedTopics,
      progress.totalTopics
    );
  }, [dashboardCopy, overviewQuery.data?.progress]);

  const greetingLabel = useMemo(() => {
    const fullName = overviewQuery.data?.session.user?.full_name?.trim();
    if (fullName && fullName.length > 0) {
      return dashboardCopy.greetingWithName(fullName);
    }

    return dashboardCopy.greetingDefault;
  }, [dashboardCopy, overviewQuery.data?.session.user?.full_name]);

  const todayLabel = useMemo(() => dashboardCopy.today(formatTodayDate(locale)), [dashboardCopy, locale]);

  return {
    dashboardCopy,
    language,
    locale,
    overviewQuery,
    roadmapProgressLabel,
    greetingLabel,
    todayLabel
  };
}
