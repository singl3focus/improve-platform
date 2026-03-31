"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@features/auth/lib/auth-fetch";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import type { WeeklyReviewData } from "@features/weekly-review/types";

type ReviewStep = 1 | 2 | 3;

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (typeof payload?.message === "string") return payload.message;
  } catch {
    // ignore
  }
  return fallback;
}

async function fetchWeeklyReview(signal?: AbortSignal): Promise<WeeklyReviewData> {
  const response = await authFetch("/api/dashboard/weekly-review", {
    method: "GET",
    signal
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to load review data."));
  }
  return (await response.json()) as WeeklyReviewData;
}

export function useWeeklyReviewViewModel() {
  const { copy } = useUserPreferences();
  const dashboardCopy = copy.dashboard;
  const weeklyReviewQuery = useQuery({
    queryKey: ["weekly-review"],
    queryFn: ({ signal }) => fetchWeeklyReview(signal),
    retry: false
  });

  const [step, setStep] = useState<ReviewStep>(1);
  const [reflectionNote, setReflectionNote] = useState("");
  const [nextWeekGoal, setNextWeekGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function rescheduleTask(taskId: string, _title: string, newDeadline: string) {
    await authFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: newDeadline })
    });
  }

  async function pauseTask(taskId: string) {
    await authFetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" })
    });
  }

  async function pauseTopic(topicId: string) {
    await authFetch(`/api/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" })
    });
  }

  async function rescheduleTopic(topicId: string, _title: string, newTargetDate: string) {
    await authFetch(`/api/roadmap/topics/${encodeURIComponent(topicId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_date: newTargetDate })
    });
  }

  async function submitReview(): Promise<boolean> {
    if (!weeklyReviewQuery.data) return false;
    setSubmitting(true);
    try {
      const response = await authFetch("/api/dashboard/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: weeklyReviewQuery.data.periodStart,
          period_end: weeklyReviewQuery.data.periodEnd,
          reflection_note: reflectionNote,
          next_week_goal: nextWeekGoal,
          completed_tasks_count: weeklyReviewQuery.data.completedTasks.length,
          completed_topics_count: weeklyReviewQuery.data.completedTopics.length
        })
      });
      return response.ok || response.status === 201;
    } catch {
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    dashboardCopy,
    data: weeklyReviewQuery.data ?? null,
    loading: weeklyReviewQuery.isPending,
    error: weeklyReviewQuery.isError
      ? weeklyReviewQuery.error instanceof Error
        ? weeklyReviewQuery.error.message
        : "Unknown error"
      : null,
    step,
    setStep,
    reflectionNote,
    setReflectionNote,
    nextWeekGoal,
    setNextWeekGoal,
    submitting,
    submitReview,
    rescheduleTask,
    pauseTask,
    pauseTopic,
    rescheduleTopic
  };
}
