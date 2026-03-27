"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { TopicWorkspace } from "@features/topics/types";
import type { MaterialType } from "@features/materials/types";
import {
  computeProgressPercent,
  parseNonNegativeInteger,
  parsePositiveInteger,
  resolveUnitByType
} from "@features/materials/lib/materials-form";

type TopicLoadStatus = "idle" | "loading" | "success" | "error";

interface TopicResourceState {
  status: TopicLoadStatus;
  data: TopicWorkspace | null;
  errorMessage: string | null;
}

export interface TopicTaskDraft {
  title: string;
  description: string;
  deadline: string;
}

export interface TopicMaterialDraft {
  title: string;
  description: string;
  type: MaterialType;
  unit: string;
  totalAmount: string;
  completedAmount: string;
  position: string;
}

interface TopicWorkspaceCopy {
  loadError: string;
  taskTitleRequired: string;
  taskCreateFailed: string;
  materialTitleDescRequired: string;
  materialAmountInvalid: string;
  materialCreateFailed: string;
}

function initialTopicState(status: TopicLoadStatus = "loading"): TopicResourceState {
  return {
    status,
    data: null,
    errorMessage: null
  };
}

function initialTaskDraft(): TopicTaskDraft {
  return { title: "", description: "", deadline: "" };
}

function initialMaterialDraft(nextPosition?: number): TopicMaterialDraft {
  const type: MaterialType = "book";
  return {
    title: "",
    description: "",
    type,
    unit: resolveUnitByType(type),
    totalAmount: "0",
    completedAmount: "0",
    position: String(nextPosition ?? 1)
  };
}

function computeNextMaterialPosition(materials: ReadonlyArray<{ position: number }>): number {
  if (materials.length === 0) {
    return 1;
  }
  return Math.max(...materials.map((m) => m.position)) + 1;
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (typeof payload?.message === "string") {
      return payload.message;
    }
  } catch {
    // Ignore non-JSON errors.
  }
  return fallback;
}

async function fetchTopicWorkspace(topicId: string, signal: AbortSignal): Promise<TopicWorkspace> {
  const response = await authFetch(`/api/topics/${encodeURIComponent(topicId)}`, {
    method: "GET",
    signal
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Topic workspace request failed."));
  }

  return (await response.json()) as TopicWorkspace;
}

async function createTaskForTopic(payload: {
  title: string;
  description?: string;
  topicId: string;
  deadline?: string;
}): Promise<void> {
  const response = await authFetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Task creation failed."));
  }
}

async function updateTopicDates(
  topicId: string,
  dates: { startDate?: string | null; targetDate?: string | null }
): Promise<void> {
  const response = await authFetch(`/api/roadmap/topics/${encodeURIComponent(topicId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start_date: dates.startDate ?? null,
      target_date: dates.targetDate ?? null
    })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Topic date update failed."));
  }
}

async function addTopicDependency(topicId: string, dependsOnTopicId: string): Promise<void> {
  const response = await authFetch(
    `/api/roadmap/topics/${encodeURIComponent(topicId)}/dependencies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depends_on_topic_id: dependsOnTopicId })
    }
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to add dependency."));
  }
}

async function removeTopicDependency(topicId: string, dependsOnTopicId: string): Promise<void> {
  const response = await authFetch(
    `/api/roadmap/topics/${encodeURIComponent(topicId)}/dependencies/${encodeURIComponent(dependsOnTopicId)}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Failed to remove dependency."));
  }
}

interface TopicOption {
  id: string;
  title: string;
}

async function fetchAllTopics(): Promise<TopicOption[]> {
  const response = await authFetch("/api/roadmap", { method: "GET" });
  if (!response.ok) return [];
  const roadmap = (await response.json()) as { stages?: Array<{ topics?: Array<{ id: string; title: string }> }> };
  const topics: TopicOption[] = [];
  for (const stage of roadmap.stages ?? []) {
    for (const topic of stage.topics ?? []) {
      topics.push({ id: topic.id, title: topic.title });
    }
  }
  return topics;
}

async function createMaterialForTopic(payload: {
  title: string;
  description: string;
  topicId: string;
  type: MaterialType;
  totalAmount: number;
  completedAmount: number;
  position: number;
}): Promise<void> {
  const response = await authFetch("/api/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Material creation failed."));
  }
}

export function useTopicWorkspaceViewModel(topicId: string | null, copy: TopicWorkspaceCopy) {
  const [state, setState] = useState<TopicResourceState>(() =>
    initialTopicState(topicId ? "loading" : "idle")
  );
  const [reloadKey, setReloadKey] = useState(0);

  // Task creation state
  const [taskDraft, setTaskDraft] = useState<TopicTaskDraft>(initialTaskDraft());
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskMutationError, setTaskMutationError] = useState<string | null>(null);

  // Dependency state
  const [availableTopics, setAvailableTopics] = useState<TopicOption[]>([]);

  // Material creation state
  const [materialDraft, setMaterialDraft] = useState<TopicMaterialDraft>(initialMaterialDraft());
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false);
  const [materialMutationError, setMaterialMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) {
      setState(initialTopicState("idle"));
      return;
    }

    const currentTopicId = topicId;
    const controller = new AbortController();

    async function load() {
      setState(initialTopicState());
      try {
        const topic = await fetchTopicWorkspace(currentTopicId, controller.signal);
        setState({
          status: "success",
          data: topic,
          errorMessage: null
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          data: null,
          errorMessage: error instanceof Error ? error.message : copy.loadError
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [topicId, reloadKey, copy.loadError]);

  useEffect(() => {
    if (topicId) {
      fetchAllTopics().then(setAvailableTopics).catch(() => setAvailableTopics([]));
    }
  }, [topicId, reloadKey]);

  useEffect(() => {
    if (state.status === "success" && state.data) {
      setMaterialDraft((current) => {
        if (current.title === "" && current.description === "") {
          const nextPosition = computeNextMaterialPosition(state.data!.materials);
          return { ...current, position: String(nextPosition) };
        }
        return current;
      });
    }
  }, [state.status, state.data]);

  const dependencySummary = useMemo(() => {
    const topic = state.data;
    if (!topic) {
      return {
        completed: 0,
        pending: 0
      };
    }

    return {
      completed: topic.dependencies.filter((dependency) => dependency.isCompleted).length,
      pending: topic.dependencies.filter((dependency) => dependency.isRequired && !dependency.isCompleted)
        .length
    };
  }, [state.data]);

  function reload() {
    setReloadKey((value) => value + 1);
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();
    if (!topicId) {
      return false;
    }

    const title = taskDraft.title.trim();
    if (!title) {
      setTaskMutationError(copy.taskTitleRequired);
      return false;
    }

    const description = taskDraft.description.trim();
    const deadline = taskDraft.deadline.trim();

    setTaskMutationError(null);
    setIsCreatingTask(true);
    try {
      await createTaskForTopic({
        title,
        ...(description ? { description } : {}),
        topicId,
        ...(deadline ? { deadline } : {})
      });
      setTaskDraft(initialTaskDraft());
      reload();
      return true;
    } catch (error) {
      setTaskMutationError(error instanceof Error ? error.message : copy.taskCreateFailed);
      return false;
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleCreateMaterial(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();
    if (!topicId) {
      return false;
    }

    const title = materialDraft.title.trim();
    const description = materialDraft.description.trim();
    if (!title || !description) {
      setMaterialMutationError(copy.materialTitleDescRequired);
      return false;
    }

    const totalAmount = parseNonNegativeInteger(materialDraft.totalAmount, 0);
    const completedAmount = parseNonNegativeInteger(materialDraft.completedAmount, 0);
    if (completedAmount > totalAmount) {
      setMaterialMutationError(copy.materialAmountInvalid);
      return false;
    }

    setMaterialMutationError(null);
    setIsCreatingMaterial(true);
    try {
      const submittedPosition = parsePositiveInteger(materialDraft.position, 1);
      await createMaterialForTopic({
        title,
        description,
        topicId,
        type: materialDraft.type,
        totalAmount,
        completedAmount,
        position: submittedPosition
      });
      const maxExisting = state.data?.materials
        ? Math.max(0, ...state.data.materials.map((m) => m.position))
        : 0;
      const nextPosition = Math.max(maxExisting, submittedPosition) + 1;
      setMaterialDraft(initialMaterialDraft(nextPosition));
      reload();
      return true;
    } catch (error) {
      setMaterialMutationError(error instanceof Error ? error.message : copy.materialCreateFailed);
      return false;
    } finally {
      setIsCreatingMaterial(false);
    }
  }

  async function handleUpdateDates(dates: {
    startDate?: string | null;
    targetDate?: string | null;
  }): Promise<void> {
    if (!topicId) return;
    try {
      await updateTopicDates(topicId, dates);
      reload();
    } catch {
      // Silently fail, user can retry
    }
  }

  async function handleAddDependency(dependsOnTopicId: string): Promise<void> {
    if (!topicId) return;
    try {
      await addTopicDependency(topicId, dependsOnTopicId);
      reload();
    } catch {
      // Silently fail
    }
  }

  async function handleRemoveDependency(dependsOnTopicId: string): Promise<void> {
    if (!topicId) return;
    try {
      await removeTopicDependency(topicId, dependsOnTopicId);
      reload();
    } catch {
      // Silently fail
    }
  }

  const dependencyOptions = availableTopics.filter((topic) => {
    if (topic.id === topicId) return false;
    if (!state.data) return true;
    return !state.data.dependencies.some((dep) => dep.topicId === topic.id);
  });

  return {
    state,
    reload,
    dependencySummary,
    handleUpdateDates,
    handleAddDependency,
    handleRemoveDependency,
    dependencyOptions,
    // Task creation
    taskDraft,
    setTaskDraft,
    isCreatingTask,
    taskMutationError,
    clearTaskMutationError: () => setTaskMutationError(null),
    handleCreateTask,
    // Material creation
    materialDraft,
    setMaterialDraft,
    isCreatingMaterial,
    materialMutationError,
    clearMaterialMutationError: () => setMaterialMutationError(null),
    handleCreateMaterial,
    computeProgressPercent
  };
}
