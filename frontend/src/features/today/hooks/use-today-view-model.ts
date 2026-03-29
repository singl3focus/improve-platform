"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { TodayResponse } from "@features/today/types";

const TODAY_QUERY_KEY = "today";

async function fetchToday(): Promise<TodayResponse> {
  const response = await authFetch("/api/today", { method: "GET" });
  if (!response.ok) {
    throw new Error("Failed to load today data");
  }
  return (await response.json()) as TodayResponse;
}

async function toggleTaskAPI(taskId: string, isCompleted: boolean): Promise<void> {
  const response = await authFetch(`/api/today/tasks/${encodeURIComponent(taskId)}/toggle`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_completed: isCompleted })
  });
  if (!response.ok) {
    throw new Error("Failed to toggle task");
  }
}

async function saveReflectionAPI(reflection: string): Promise<void> {
  const response = await authFetch("/api/today/reflection", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reflection })
  });
  if (!response.ok) {
    throw new Error("Failed to save reflection");
  }
}

async function createTaskAPI(title: string): Promise<{ id: string }> {
  const response = await authFetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  if (!response.ok) {
    throw new Error("Failed to create task");
  }
  return (await response.json()) as { id: string };
}

async function setTasksAPI(taskIds: string[]): Promise<void> {
  const response = await authFetch("/api/today/tasks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_ids: taskIds })
  });
  if (!response.ok) {
    throw new Error("Failed to update tasks");
  }
}

export function useTodayViewModel() {
  const queryClient = useQueryClient();
  const [reflectionDraft, setReflectionDraft] = useState("");
  const [reflectionInitialized, setReflectionInitialized] = useState(false);

  const {
    data: today,
    isLoading,
    isError
  } = useQuery({
    queryKey: [TODAY_QUERY_KEY],
    queryFn: fetchToday,
    staleTime: 30 * 1000
  });

  // Initialize draft from server data
  if (today && !reflectionInitialized) {
    setReflectionDraft(today.reflection ?? "");
    setReflectionInitialized(true);
  }

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) =>
      toggleTaskAPI(taskId, isCompleted),
    onMutate: async ({ taskId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey: [TODAY_QUERY_KEY] });
      const previous = queryClient.getQueryData<TodayResponse>([TODAY_QUERY_KEY]);
      queryClient.setQueryData<TodayResponse>([TODAY_QUERY_KEY], (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t) =>
            t.id === taskId ? { ...t, isCompleted } : t
          )
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([TODAY_QUERY_KEY], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [TODAY_QUERY_KEY] });
    }
  });

  const reflectionMutation = useMutation({
    mutationFn: (reflection: string) => saveReflectionAPI(reflection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TODAY_QUERY_KEY] });
    }
  });

  const setTasksMutation = useMutation({
    mutationFn: (taskIds: string[]) => setTasksAPI(taskIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TODAY_QUERY_KEY] });
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const createdTask = await createTaskAPI(title);
      const currentTaskIds =
        queryClient.getQueryData<TodayResponse>([TODAY_QUERY_KEY])?.tasks.map((task) => task.id) ?? [];
      await setTasksAPI([...currentTaskIds, createdTask.id]);
      return createdTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TODAY_QUERY_KEY] });
    }
  });

  const toggleTask = useCallback(
    (taskId: string) => {
      const task = today?.tasks.find((t) => t.id === taskId);
      if (task) {
        toggleMutation.mutate({ taskId, isCompleted: !task.isCompleted });
      }
    },
    [today, toggleMutation]
  );

  const saveReflection = useCallback(() => {
    if (reflectionDraft.trim()) {
      reflectionMutation.mutate(reflectionDraft.trim());
    }
  }, [reflectionDraft, reflectionMutation]);

  return {
    today,
    isLoading,
    isError,
    toggleTask,
    saveReflection,
    reflectionDraft,
    setReflectionDraft,
    setTasksMutation,
    reflectionSaving: reflectionMutation.isPending,
    createTodayTask: (title: string) => createTaskMutation.mutateAsync(title),
    creatingTask: createTaskMutation.isPending
  };
}
