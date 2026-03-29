"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@features/auth/lib/auth-fetch";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import type { WeeklyReviewData } from "@features/weekly-review/types";

type ReviewStep = 1 | 2 | 3;

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (typeof payload?.message === "string") return payload.message;
  } catch { /* ignore */ }
  return fallback;
}

export function useWeeklyReviewViewModel() {
  const { copy } = useUserPreferences();
  const dashboardCopy = copy.dashboard;

  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ReviewStep>(1);
  const [reflectionNote, setReflectionNote] = useState("");
  const [nextWeekGoal, setNextWeekGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch("/api/dashboard/weekly-review", {
          method: "GET",
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(await parseError(response, "Failed to load review data."));
        }
        const payload = (await response.json()) as WeeklyReviewData;
        setData(payload);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

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
    if (!data) return false;
    setSubmitting(true);
    try {
      const response = await authFetch("/api/dashboard/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: data.periodStart,
          period_end: data.periodEnd,
          reflection_note: reflectionNote,
          next_week_goal: nextWeekGoal,
          completed_tasks_count: data.completedTasks.length,
          completed_topics_count: data.completedTopics.length
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
    data,
    loading,
    error,
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
