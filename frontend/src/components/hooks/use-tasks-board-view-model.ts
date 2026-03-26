"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/auth/auth-fetch";
import type { AppLanguage } from "@/lib/ui-copy";
import type {
  TaskBoardDueFilter,
  TaskBoardItem,
  TaskBoardStatus
} from "@/lib/tasks-board-types";

interface TaskBoardTopicOption {
  id: string;
  title: string;
}

interface TaskBoardPayload {
  tasks: TaskBoardItem[];
  topics: TaskBoardTopicOption[];
}

interface CreateTaskPayload {
  title: string;
  description?: string;
  topicId?: string;
  deadline?: string;
}

interface UpdateTaskPayload {
  title: string;
  description?: string;
  topicId?: string | null;
  deadline?: string;
}

type TaskBoardLoadStatus = "loading" | "success" | "error";

interface TaskBoardState {
  status: TaskBoardLoadStatus;
  data: TaskBoardPayload | null;
  errorMessage: string | null;
}

export interface TaskBoardFilters {
  topicId: string;
  due: TaskBoardDueFilter;
}

export interface TaskCreateDraft {
  title: string;
  description: string;
  topicId: string;
  deadline: string;
}

interface TasksBoardCopyForViewModel {
  loadError: string;
  titleRequired: string;
  createFailed: string;
  updateFailed: string;
  deleteFailed: string;
}

function initialBoardState(): TaskBoardState {
  return {
    status: "loading",
    data: null,
    errorMessage: null
  };
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

async function fetchTasksBoard(
  filters: TaskBoardFilters,
  signal: AbortSignal
): Promise<TaskBoardPayload> {
  const params = new URLSearchParams();
  if (filters.topicId) {
    params.set("topicId", filters.topicId);
  }
  params.set("due", filters.due);

  const response = await authFetch(`/api/tasks?${params.toString()}`, {
    method: "GET",
    signal
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Tasks board failed to load."));
  }

  return (await response.json()) as TaskBoardPayload;
}

function initialTaskCreateDraft(): TaskCreateDraft {
  return {
    title: "",
    description: "",
    topicId: "",
    deadline: ""
  };
}

async function patchTaskStatus(taskId: string, status: TaskBoardStatus): Promise<TaskBoardItem> {
  const response = await authFetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Task status update failed."));
  }

  return (await response.json()) as TaskBoardItem;
}

async function createTask(payload: CreateTaskPayload): Promise<TaskBoardItem> {
  const response = await authFetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Task creation failed."));
  }

  return (await response.json()) as TaskBoardItem;
}

async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<TaskBoardItem> {
  const response = await authFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Task update failed."));
  }

  return (await response.json()) as TaskBoardItem;
}

async function deleteTask(taskId: string): Promise<void> {
  const response = await authFetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Task removal failed."));
  }
}

export function formatTaskDueDate(value: string, language: AppLanguage, fallback: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function isTaskOverdue(task: TaskBoardItem): boolean {
  if (task.status === "completed") {
    return false;
  }
  const date = new Date(task.dueAt);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.getTime() < Date.now();
}

function isTaskDueWithinWeek(task: TaskBoardItem): boolean {
  const date = new Date(task.dueAt);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return date.getTime() >= now && date.getTime() <= now + sevenDaysMs;
}

function doesTaskMatchFilters(task: TaskBoardItem, filters: TaskBoardFilters): boolean {
  if (filters.topicId && task.topicId !== filters.topicId) {
    return false;
  }

  if (filters.due === "overdue") {
    return isTaskOverdue(task);
  }

  if (filters.due === "week") {
    return isTaskDueWithinWeek(task);
  }

  return true;
}

export function getTaskColumnConfig(language: AppLanguage): Array<{
  status: TaskBoardStatus;
  label: string;
  dotClass: string;
}> {
  if (language === "ru") {
    return [
      { status: "new", label: "Новая", dotClass: "tasks-column-dot-new" },
      { status: "in_progress", label: "В работе", dotClass: "tasks-column-dot-in-progress" },
      { status: "paused", label: "На паузе", dotClass: "tasks-column-dot-paused" },
      { status: "completed", label: "Выполнена", dotClass: "tasks-column-dot-completed" }
    ];
  }

  return [
    { status: "new", label: "New", dotClass: "tasks-column-dot-new" },
    { status: "in_progress", label: "In progress", dotClass: "tasks-column-dot-in-progress" },
    { status: "paused", label: "Paused", dotClass: "tasks-column-dot-paused" },
    { status: "completed", label: "Completed", dotClass: "tasks-column-dot-completed" }
  ];
}

export function useTasksBoardViewModel(copy: TasksBoardCopyForViewModel) {
  const [filters, setFilters] = useState<TaskBoardFilters>({
    topicId: "",
    due: "all"
  });
  const [createDraft, setCreateDraft] = useState<TaskCreateDraft>(initialTaskCreateDraft());
  const [state, setState] = useState<TaskBoardState>(initialBoardState());
  const [reloadKey, setReloadKey] = useState(0);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  function clearMutationError() {
    setMutationError(null);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState(initialBoardState());
      try {
        const payload = await fetchTasksBoard(filters, controller.signal);
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
          errorMessage: error instanceof Error ? error.message : copy.loadError
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [filters, reloadKey, copy.loadError]);

  const groupedTasks = useMemo(() => {
    const map: Record<TaskBoardStatus, TaskBoardItem[]> = {
      new: [],
      in_progress: [],
      paused: [],
      completed: []
    };
    if (!state.data) {
      return map;
    }
    for (const task of state.data.tasks) {
      map[task.status].push(task);
    }
    return map;
  }, [state.data]);

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();

    const title = createDraft.title.trim();
    if (!title) {
      setMutationError(copy.titleRequired);
      return false;
    }

    const description = createDraft.description.trim();
    const topicId = createDraft.topicId.trim();
    const deadline = createDraft.deadline.trim();

    setMutationError(null);
    setIsCreating(true);
    try {
      const createdTask = await createTask({
        title,
        ...(description ? { description } : {}),
        ...(topicId ? { topicId } : {}),
        ...(deadline ? { deadline } : {})
      });

      setState((current) => {
        if (current.status !== "success" || !current.data) {
          return current;
        }

        const topicTitle =
          createdTask.topicId && !createdTask.topicTitle
            ? (current.data.topics.find((topic) => topic.id === createdTask.topicId)?.title ?? null)
            : createdTask.topicTitle;
        const normalizedTask = {
          ...createdTask,
          topicTitle
        };

        if (!doesTaskMatchFilters(normalizedTask, filters)) {
          return current;
        }

        return {
          ...current,
          data: {
            ...current.data,
            tasks: [normalizedTask, ...current.data.tasks]
          }
        };
      });

      setCreateDraft((current) => ({
        ...initialTaskCreateDraft(),
        topicId: current.topicId
      }));
      return true;
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : copy.createFailed);
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  async function handleStatusChange(taskId: string, status: TaskBoardStatus) {
    if (!state.data) {
      return;
    }
    const currentTask = state.data.tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === status) {
      return;
    }

    const previousTasks = state.data.tasks.map((task) => ({ ...task }));
    setMutationError(null);
    setUpdatingTaskId(taskId);

    setState((current) => {
      if (current.status !== "success" || !current.data) {
        return current;
      }
      return {
        ...current,
        data: {
          ...current.data,
          tasks: current.data.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status
                }
              : task
          )
        }
      };
    });

    try {
      const updatedTask = await patchTaskStatus(taskId, status);
      setState((current) => {
        if (current.status !== "success" || !current.data) {
          return current;
        }

        return {
          ...current,
          data: {
            ...current.data,
            tasks: current.data.tasks.map((task) =>
              task.id === taskId ? { ...task, ...updatedTask } : task
            )
          }
        };
      });
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Task update failed.");
      setState((current) => {
        if (current.status !== "success" || !current.data) {
          return current;
        }
        return {
          ...current,
          data: {
            ...current.data,
            tasks: previousTasks
          }
        };
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleUpdate(taskId: string, draft: TaskCreateDraft): Promise<boolean> {
    if (!state.data) {
      return false;
    }

    const title = draft.title.trim();
    if (!title) {
      setMutationError(copy.titleRequired);
      return false;
    }

    const description = draft.description.trim();
    const topicId = draft.topicId.trim();
    const deadline = draft.deadline.trim();

    setMutationError(null);
    setUpdatingTaskId(taskId);

    try {
      const updatedTask = await updateTask(taskId, {
        title,
        description,
        topicId: topicId || null,
        ...(deadline ? { deadline } : {})
      });

      setState((current) => {
        if (current.status !== "success" || !current.data) {
          return current;
        }

        if (!doesTaskMatchFilters(updatedTask, filters)) {
          return {
            ...current,
            data: {
              ...current.data,
              tasks: current.data.tasks.filter((task) => task.id !== taskId)
            }
          };
        }

        return {
          ...current,
          data: {
            ...current.data,
            tasks: current.data.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    ...updatedTask
                  }
                : task
            )
          }
        };
      });

      return true;
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : copy.updateFailed);
      return false;
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleDelete(taskId: string) {
    if (!state.data) {
      return;
    }

    const previousTasks = state.data.tasks.map((task) => ({ ...task }));
    setMutationError(null);
    setUpdatingTaskId(taskId);

    setState((current) => {
      if (current.status !== "success" || !current.data) {
        return current;
      }
      return {
        ...current,
        data: {
          ...current.data,
          tasks: current.data.tasks.filter((task) => task.id !== taskId)
        }
      };
    });

    try {
      await deleteTask(taskId);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : copy.deleteFailed);
      setState((current) => {
        if (current.status !== "success" || !current.data) {
          return current;
        }
        return {
          ...current,
          data: {
            ...current.data,
            tasks: previousTasks
          }
        };
      });
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return {
    filters,
    setFilters,
    createDraft,
    setCreateDraft,
    state,
    reload: () => setReloadKey((value) => value + 1),
    updatingTaskId,
    isCreating,
    mutationError,
    clearMutationError,
    groupedTasks,
    handleCreate,
    handleUpdate,
    handleStatusChange,
    handleDelete
  };
}
