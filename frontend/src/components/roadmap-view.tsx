"use client";

import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import type { AppLanguage } from "@/lib/ui-copy";
import type {
  RoadmapResponse,
  RoadmapTopic,
  RoadmapTopicStatus
} from "@/lib/roadmap-types";

type RoadmapLoadStatus = "loading" | "success" | "error";

interface RoadmapState {
  status: RoadmapLoadStatus;
  data: RoadmapResponse | null;
  errorMessage: string | null;
}

interface RoadmapConnection {
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface QuickCreateDraft {
  topicTitle: string;
  topicDescription: string;
}

interface TopicCreateDraft {
  stageId: string;
  title: string;
  description: string;
  position: string;
}

interface StageCreateDraft {
  title: string;
  position: string;
}

interface StageEditDraft {
  stageId: string;
  title: string;
  position: string;
}

interface TopicEditDraft {
  topicId: string;
  stageId: string;
  title: string;
  description: string;
  position: string;
}

interface DependencyDraft {
  topicId: string;
  prerequisiteTopicId: string;
}

interface ApiErrorDetails {
  message: string;
  code: string | null;
}

const ROADMAP_COPY = {
  ru: {
    title: "Дорожная карта обучения",
    subtitle:
      "Отслеживайте прогресс по этапам, зависимости между темами и текущие блокировки.",
    loadingTitle: "Загрузка графа roadmap...",
    retry: "Повторить",
    errorFallback: "Не удалось загрузить roadmap.",
    stageAria: "Этапы roadmap",
    topicsCount: (count: number) => `${count} тем`,
    topicOpenAria: (title: string) => `${title}. Открыть детали темы.`,
    blocked: "Заблокировано",
    progress: "Прогресс",
    tasksCount: (count: number) => `${count} задач`,
    materialsCount: (count: number) => `${count} материалов`,
    prerequisites: "Зависимости",
    legendCompleted: (count: number) => `Выполнено (${count})`,
    legendInProgress: (count: number) => `В работе (${count})`,
    legendBlocked: (count: number) => `Заблокировано (${count})`,
    nextAvailableTopic: (value: string) => `Следующая доступная тема: ${value}`,
    noUnlockedTopics: "Пока нет разблокированных тем.",
    empty: "Roadmap пока пуст. Добавьте темы и зависимости, чтобы построить граф.",
    quickCreateTitle: "Быстрое создание первой темы",
    quickCreateSubtitle:
      "Создадим roadmap, этап и первую тему одним действием. Вы сможете отредактировать детали позже.",
    quickCreateTopicLabel: "Название темы",
    quickCreateTopicPlaceholder: "Например: Основы HTML и CSS",
    quickCreateDescriptionLabel: "Описание темы",
    quickCreateDescriptionPlaceholder: "Кратко: что нужно изучить по этой теме",
    quickCreateButton: "Создать первую тему",
    quickCreatingButton: "Создание...",
    quickCreateTopicRequired: "Укажите название первой темы.",
    quickCreateFailed: "Не удалось создать первую тему.",
    stageManageTitle: "Управление этапами",
    stageManageSubtitle: "Создавайте, редактируйте и удаляйте этапы roadmap.",
    stageFieldTitle: "Название этапа",
    stageFieldPosition: "Позиция",
    stageTitlePlaceholder: "Например: Базовый уровень",
    stageCreateButton: "Создать этап",
    stageCreatingButton: "Создание...",
    stageEditButton: "Редактировать этап",
    stageDeleteButton: "Удалить этап",
    stageSaveButton: "Сохранить",
    stageCancelButton: "Отмена",
    stageUpdatingButton: "Сохранение...",
    stageDeletingButton: "Удаление...",
    stageTitleRequired: "Укажите название этапа.",
    stageCreateFailed: "Не удалось создать этап.",
    stageUpdateFailed: "Не удалось обновить этап.",
    stageDeleteFailed: "Не удалось удалить этап.",
    stageDeleteConfirm: (title: string) => `Удалить этап «${title}»?`,
    stageCreateSuccess: "Этап создан.",
    stageUpdateSuccess: "Этап обновлён.",
    stageDeleteSuccess: "Этап удалён.",
    topicCreateTitle: "Добавить тему",
    topicCreateSubtitle: "Создайте новую тему в выбранном этапе текущего roadmap.",
    topicFieldStage: "Этап",
    topicFieldTitle: "Название",
    topicFieldDescription: "Описание",
    topicFieldPosition: "Позиция",
    topicTitlePlaceholder: "Например: Работа с формами",
    topicDescriptionPlaceholder: "Кратко: что изучаем в этой теме",
    topicCreateButton: "Добавить тему",
    topicCreatingButton: "Добавление...",
    topicEditButton: "Редактировать",
    topicDeleteButton: "Удалить",
    topicSaveButton: "Сохранить",
    topicCancelButton: "Отмена",
    topicUpdatingButton: "Сохранение...",
    topicDeletingButton: "Удаление...",
    topicStageRequired: "Выберите этап для темы.",
    topicTitleRequired: "Укажите название темы.",
    topicCreateFailed: "Не удалось добавить тему.",
    topicUpdateFailed: "Не удалось обновить тему.",
    topicDeleteFailed: "Не удалось удалить тему.",
    topicDeleteConfirm: (title: string) => `Удалить тему «${title}»?`,
    dependencyManageTitle: "Управление зависимостями",
    dependencyManageSubtitle: "Добавляйте и удаляйте связи между темами в графе roadmap.",
    dependencyTopicLabel: "Тема",
    dependencyPrerequisiteLabel: "Требуемая тема",
    dependencyAddButton: "Добавить связь",
    dependencyAddingButton: "Добавление...",
    dependencyRemoveButton: "Удалить связь",
    dependencyRemovingButton: "Удаление...",
    dependencyTopicRequired: "Выберите тему для настройки зависимостей.",
    dependencyPrerequisiteRequired: "Выберите тему-зависимость.",
    dependencySelfError: "Тема не может зависеть сама от себя.",
    dependencyCycleError: "Эта связь создаёт цикл и не может быть добавлена.",
    dependencyAddFailed: "Не удалось добавить зависимость.",
    dependencyRemoveFailed: "Не удалось удалить зависимость.",
    defaultRoadmapTitle: "План обучения",
    defaultStageTitle: "Этап 1"
  },
  en: {
    title: "Learning roadmap",
    subtitle:
      "Track stage-by-stage progress, follow topic dependencies, and see what is blocked right now.",
    loadingTitle: "Loading roadmap graph...",
    retry: "Retry",
    errorFallback: "Roadmap failed to load.",
    stageAria: "Roadmap stages",
    topicsCount: (count: number) => `${count} topics`,
    topicOpenAria: (title: string) => `${title}. Open topic details.`,
    blocked: "Blocked",
    progress: "Progress",
    tasksCount: (count: number) => `${count} tasks`,
    materialsCount: (count: number) => `${count} materials`,
    prerequisites: "Prerequisites",
    legendCompleted: (count: number) => `Completed (${count})`,
    legendInProgress: (count: number) => `In progress (${count})`,
    legendBlocked: (count: number) => `Blocked (${count})`,
    nextAvailableTopic: (value: string) => `Next available topic: ${value}`,
    noUnlockedTopics: "No unlocked topics yet.",
    empty: "Roadmap is empty. Add topics and dependencies to render the graph.",
    quickCreateTitle: "Quick create first topic",
    quickCreateSubtitle:
      "Create roadmap, stage, and the first topic in one action. You can edit details later.",
    quickCreateTopicLabel: "Topic title",
    quickCreateTopicPlaceholder: "For example: HTML and CSS basics",
    quickCreateDescriptionLabel: "Topic description",
    quickCreateDescriptionPlaceholder: "Short note about what to learn in this topic",
    quickCreateButton: "Create first topic",
    quickCreatingButton: "Creating...",
    quickCreateTopicRequired: "First topic title is required.",
    quickCreateFailed: "Failed to create first topic.",
    stageManageTitle: "Stage management",
    stageManageSubtitle: "Create, edit, and delete roadmap stages.",
    stageFieldTitle: "Stage title",
    stageFieldPosition: "Position",
    stageTitlePlaceholder: "For example: Fundamentals",
    stageCreateButton: "Create stage",
    stageCreatingButton: "Creating...",
    stageEditButton: "Edit stage",
    stageDeleteButton: "Delete stage",
    stageSaveButton: "Save",
    stageCancelButton: "Cancel",
    stageUpdatingButton: "Saving...",
    stageDeletingButton: "Deleting...",
    stageTitleRequired: "Stage title is required.",
    stageCreateFailed: "Stage creation failed.",
    stageUpdateFailed: "Stage update failed.",
    stageDeleteFailed: "Stage removal failed.",
    stageDeleteConfirm: (title: string) => `Delete stage "${title}"?`,
    stageCreateSuccess: "Stage created.",
    stageUpdateSuccess: "Stage updated.",
    stageDeleteSuccess: "Stage removed.",
    topicCreateTitle: "Add topic",
    topicCreateSubtitle: "Create a new topic in the selected stage of your current roadmap.",
    topicFieldStage: "Stage",
    topicFieldTitle: "Title",
    topicFieldDescription: "Description",
    topicFieldPosition: "Position",
    topicTitlePlaceholder: "For example: Working with forms",
    topicDescriptionPlaceholder: "Short note about what to learn in this topic",
    topicCreateButton: "Add topic",
    topicCreatingButton: "Adding...",
    topicEditButton: "Edit",
    topicDeleteButton: "Delete",
    topicSaveButton: "Save",
    topicCancelButton: "Cancel",
    topicUpdatingButton: "Saving...",
    topicDeletingButton: "Deleting...",
    topicStageRequired: "Choose a stage for the topic.",
    topicTitleRequired: "Topic title is required.",
    topicCreateFailed: "Topic creation failed.",
    topicUpdateFailed: "Topic update failed.",
    topicDeleteFailed: "Topic removal failed.",
    topicDeleteConfirm: (title: string) => `Delete topic "${title}"?`,
    dependencyManageTitle: "Dependency management",
    dependencyManageSubtitle: "Add and remove graph links between roadmap topics.",
    dependencyTopicLabel: "Topic",
    dependencyPrerequisiteLabel: "Prerequisite topic",
    dependencyAddButton: "Add link",
    dependencyAddingButton: "Adding...",
    dependencyRemoveButton: "Remove link",
    dependencyRemovingButton: "Removing...",
    dependencyTopicRequired: "Choose a topic to configure dependencies.",
    dependencyPrerequisiteRequired: "Choose a prerequisite topic.",
    dependencySelfError: "A topic cannot depend on itself.",
    dependencyCycleError: "This link creates a cycle and cannot be added.",
    dependencyAddFailed: "Dependency creation failed.",
    dependencyRemoveFailed: "Dependency removal failed.",
    defaultRoadmapTitle: "Learning roadmap",
    defaultStageTitle: "Stage 1"
  }
} as const;

function initialRoadmapState(): RoadmapState {
  return {
    status: "loading",
    data: null,
    errorMessage: null
  };
}

async function fetchRoadmap(signal: AbortSignal): Promise<RoadmapResponse> {
  const response = await fetch("/api/roadmap", {
    method: "GET",
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    let message = `Roadmap request failed (${response.status})`;
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

  return (await response.json()) as RoadmapResponse;
}

function initialQuickCreateDraft(): QuickCreateDraft {
  return {
    topicTitle: "",
    topicDescription: ""
  };
}

function initialTopicCreateDraft(): TopicCreateDraft {
  return {
    stageId: "",
    title: "",
    description: "",
    position: "1"
  };
}

function initialStageCreateDraft(): StageCreateDraft {
  return {
    title: "",
    position: "1"
  };
}

function initialDependencyDraft(): DependencyDraft {
  return {
    topicId: "",
    prerequisiteTopicId: ""
  };
}

async function parseErrorDetails(response: Response, fallback: string): Promise<ApiErrorDetails> {
  try {
    const payload = (await response.json()) as { message?: string; code?: string };
    const message = typeof payload?.message === "string" ? payload.message : fallback;
    const code = typeof payload?.code === "string" ? payload.code : null;
    return { message, code };
  } catch {
    // Ignore non-JSON error bodies.
  }

  return {
    message: fallback,
    code: null
  };
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  const details = await parseErrorDetails(response, fallback);
  return details.message;
}

function createErrorWithCode(details: ApiErrorDetails): Error {
  const error = new Error(details.message);
  (error as Error & { code?: string }).code = details.code ?? undefined;
  return error;
}

function getErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const codeValue = (error as { code?: unknown }).code;
    if (typeof codeValue === "string" && codeValue.length > 0) {
      return codeValue;
    }
  }

  return null;
}

function getDependencyErrorMessage(
  error: unknown,
  copy: (typeof ROADMAP_COPY)[keyof typeof ROADMAP_COPY]
): string {
  const code = getErrorCode(error);
  if (code === "self_dependency") {
    return copy.dependencySelfError;
  }
  if (code === "cycle_detected") {
    return copy.dependencyCycleError;
  }

  return error instanceof Error ? error.message : copy.dependencyAddFailed;
}

async function quickCreateFirstTopic(payload: {
  roadmapTitle: string;
  stageTitle: string;
  topicTitle: string;
  topicDescription: string;
}): Promise<void> {
  const response = await fetch("/api/roadmap/quick-create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap quick-create failed."));
  }
}

async function createRoadmapTopic(payload: {
  stageId: string;
  title: string;
  description: string;
  position: number;
}): Promise<void> {
  const response = await fetch("/api/roadmap/topics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap topic creation failed."));
  }
}

async function createRoadmapStage(payload: { title: string; position: number }): Promise<void> {
  const response = await fetch("/api/roadmap/stages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap stage creation failed."));
  }
}

async function updateRoadmapStage(
  stageId: string,
  payload: { title: string; position: number }
): Promise<void> {
  const response = await fetch(`/api/roadmap/stages/${encodeURIComponent(stageId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap stage update failed."));
  }
}

async function deleteRoadmapStage(stageId: string): Promise<void> {
  const response = await fetch(`/api/roadmap/stages/${encodeURIComponent(stageId)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap stage removal failed."));
  }
}

async function updateRoadmapTopic(
  topicId: string,
  payload: {
    stageId: string;
    title: string;
    description: string;
    position: number;
  }
): Promise<void> {
  const response = await fetch(`/api/roadmap/topics/${encodeURIComponent(topicId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap topic update failed."));
  }
}

async function deleteRoadmapTopic(topicId: string): Promise<void> {
  const response = await fetch(`/api/roadmap/topics/${encodeURIComponent(topicId)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap topic removal failed."));
  }
}

async function createRoadmapDependency(payload: {
  topicId: string;
  prerequisiteTopicId: string;
}): Promise<void> {
  const response = await fetch(
    `/api/roadmap/topics/${encodeURIComponent(payload.topicId)}/dependencies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prerequisiteTopicId: payload.prerequisiteTopicId
      })
    }
  );

  if (!response.ok) {
    throw createErrorWithCode(
      await parseErrorDetails(response, "Roadmap dependency creation failed.")
    );
  }
}

async function deleteRoadmapDependency(topicId: string, dependencyTopicId: string): Promise<void> {
  const response = await fetch(
    `/api/roadmap/topics/${encodeURIComponent(topicId)}/dependencies/${encodeURIComponent(
      dependencyTopicId
    )}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw createErrorWithCode(
      await parseErrorDetails(response, "Roadmap dependency removal failed.")
    );
  }
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function getStatusLabel(status: RoadmapTopicStatus, language: AppLanguage): string {
  if (language === "ru") {
    if (status === "completed") {
      return "Выполнено";
    }
    if (status === "in_progress") {
      return "В работе";
    }
    if (status === "paused") {
      return "На паузе";
    }
    return "Не начато";
  }

  if (status === "completed") {
    return "Completed";
  }
  if (status === "in_progress") {
    return "In progress";
  }
  if (status === "paused") {
    return "Paused";
  }
  return "Not started";
}

function getStatusClassName(status: RoadmapTopicStatus): string {
  if (status === "completed") {
    return "roadmap-status-completed";
  }
  if (status === "in_progress") {
    return "roadmap-status-in-progress";
  }
  if (status === "paused") {
    return "roadmap-status-paused";
  }
  return "roadmap-status-not-started";
}

function useRoadmapData(errorFallback: string) {
  const [state, setState] = useState<RoadmapState>(initialRoadmapState());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState(initialRoadmapState());
      try {
        const payload = await fetchRoadmap(controller.signal);
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
          errorMessage: error instanceof Error ? error.message : errorFallback
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadKey, errorFallback]);

  return {
    state,
    reload: () => setReloadKey((value) => value + 1)
  };
}

export function RoadmapView() {
  const router = useRouter();
  const { language } = useUserPreferences();
  const copy = ROADMAP_COPY[language];
  const roadmap = useRoadmapData(copy.errorFallback);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const topicRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [connections, setConnections] = useState<RoadmapConnection[]>([]);
  const [graphSize, setGraphSize] = useState({
    width: 1,
    height: 1
  });
  const [quickCreateDraft, setQuickCreateDraft] = useState<QuickCreateDraft>(initialQuickCreateDraft());
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const [stageCreateDraft, setStageCreateDraft] = useState<StageCreateDraft>(
    initialStageCreateDraft()
  );
  const [stageEditDraft, setStageEditDraft] = useState<StageEditDraft | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageMutationError, setStageMutationError] = useState<string | null>(null);
  const [stageMutationSuccess, setStageMutationSuccess] = useState<string | null>(null);
  const [isStageCreating, setIsStageCreating] = useState(false);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
  const [topicCreateDraft, setTopicCreateDraft] = useState<TopicCreateDraft>(initialTopicCreateDraft());
  const [topicEditDraft, setTopicEditDraft] = useState<TopicEditDraft | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicMutationError, setTopicMutationError] = useState<string | null>(null);
  const [isTopicCreating, setIsTopicCreating] = useState(false);
  const [updatingTopicId, setUpdatingTopicId] = useState<string | null>(null);
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  const [dependencyDraft, setDependencyDraft] = useState<DependencyDraft>(initialDependencyDraft());
  const [dependencyMutationError, setDependencyMutationError] = useState<string | null>(null);
  const [isDependencyCreating, setIsDependencyCreating] = useState(false);
  const [removingDependencyKey, setRemovingDependencyKey] = useState<string | null>(null);

  const stages = useMemo(() => roadmap.state.data?.stages ?? [], [roadmap.state.data]);
  const stageById = useMemo(() => {
    const map = new Map<string, (typeof stages)[number]>();
    for (const stage of stages) {
      map.set(stage.id, stage);
    }
    return map;
  }, [stages]);

  const topicById = useMemo(() => {
    const map = new Map<string, RoadmapTopic>();
    for (const stage of stages) {
      for (const topic of stage.topics) {
        map.set(topic.id, topic);
      }
    }
    return map;
  }, [stages]);

  const allTopics = useMemo(() => stages.flatMap((stage) => stage.topics), [stages]);

  const statusCounters = useMemo(() => {
    return {
      completed: allTopics.filter((topic) => topic.status === "completed").length,
      inProgress: allTopics.filter((topic) => topic.status === "in_progress").length,
      blocked: allTopics.filter((topic) => topic.isBlocked).length
    };
  }, [allTopics]);

  const nextTopic = useMemo(() => {
    return (
      allTopics.find(
        (topic) =>
          !topic.isBlocked && (topic.status === "not_started" || topic.status === "paused")
      ) ?? null
    );
  }, [allTopics]);

  useEffect(() => {
    if (stages.length === 0) {
      return;
    }

    setStageCreateDraft((current) => {
      const nextPosition = String(stages.length + 1);
      if (current.position === nextPosition) {
        return current;
      }

      return {
        ...current,
        position: nextPosition
      };
    });

    setTopicCreateDraft((current) => {
      const selectedStage = stageById.get(current.stageId) ?? stages[0];
      const nextPosition = String((selectedStage?.topics.length ?? 0) + 1);

      if (current.stageId === selectedStage.id && current.position === nextPosition) {
        return current;
      }

      return {
        ...current,
        stageId: selectedStage.id,
        position: nextPosition
      };
    });
  }, [stageById, stages]);

  useEffect(() => {
    if (allTopics.length === 0) {
      return;
    }

    setDependencyDraft((current) => {
      const topicId = topicById.has(current.topicId) ? current.topicId : allTopics[0]?.id ?? "";
      const fallbackPrerequisite =
        allTopics.find((topic) => topic.id !== topicId)?.id ?? allTopics[0]?.id ?? "";
      const prerequisiteTopicId =
        current.prerequisiteTopicId && topicById.has(current.prerequisiteTopicId)
          ? current.prerequisiteTopicId
          : fallbackPrerequisite;

      if (topicId === current.topicId && prerequisiteTopicId === current.prerequisiteTopicId) {
        return current;
      }

      return {
        topicId,
        prerequisiteTopicId
      };
    });
  }, [allTopics, topicById]);

  useEffect(() => {
    if (roadmap.state.status !== "success" || !roadmap.state.data) {
      setConnections([]);
      return;
    }

    const graphElement = graphRef.current;
    if (!graphElement) {
      return;
    }

    let frame = 0;

    const recalculate = () => {
      const containerRect = graphElement.getBoundingClientRect();
      const nextConnections: RoadmapConnection[] = [];

      for (const stage of roadmap.state.data?.stages ?? []) {
        for (const topic of stage.topics) {
          for (const prerequisiteTopicId of topic.prerequisiteTopicIds) {
            const fromElement = topicRefs.current.get(prerequisiteTopicId);
            const toElement = topicRefs.current.get(topic.id);

            if (!fromElement || !toElement) {
              continue;
            }

            const fromRect = fromElement.getBoundingClientRect();
            const toRect = toElement.getBoundingClientRect();

            nextConnections.push({
              fromId: prerequisiteTopicId,
              toId: topic.id,
              x1: fromRect.right - containerRect.left,
              y1: fromRect.top + fromRect.height / 2 - containerRect.top,
              x2: toRect.left - containerRect.left,
              y2: toRect.top + toRect.height / 2 - containerRect.top
            });
          }
        }
      }

      setConnections(nextConnections);
      setGraphSize({
        width: Math.max(graphElement.clientWidth, 1),
        height: Math.max(graphElement.clientHeight, 1)
      });
    };

    const scheduleRecalculate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recalculate);
    };

    scheduleRecalculate();
    window.addEventListener("resize", scheduleRecalculate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleRecalculate);
    };
  }, [roadmap.state.status, roadmap.state.data]);

  function onTopicKeyDown(event: KeyboardEvent<HTMLElement>, topicId: string) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(`/topics?topicId=${encodeURIComponent(topicId)}`);
    }
  }

  function stopTopicCardEvent(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function setTopicElement(topicId: string, element: HTMLElement | null) {
    if (element) {
      topicRefs.current.set(topicId, element);
      return;
    }

    topicRefs.current.delete(topicId);
  }

  async function handleQuickCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const topicTitle = quickCreateDraft.topicTitle.trim();
    if (!topicTitle) {
      setQuickCreateError(copy.quickCreateTopicRequired);
      return;
    }

    setQuickCreateError(null);
    setIsQuickCreating(true);
    try {
      await quickCreateFirstTopic({
        roadmapTitle: copy.defaultRoadmapTitle,
        stageTitle: copy.defaultStageTitle,
        topicTitle,
        topicDescription: quickCreateDraft.topicDescription.trim()
      });
      setQuickCreateDraft(initialQuickCreateDraft());
      roadmap.reload();
    } catch (error) {
      setQuickCreateError(error instanceof Error ? error.message : copy.quickCreateFailed);
    } finally {
      setIsQuickCreating(false);
    }
  }

  async function handleTopicCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const stageId = topicCreateDraft.stageId.trim();
    const title = topicCreateDraft.title.trim();
    if (!stageId) {
      setTopicMutationError(copy.topicStageRequired);
      return;
    }
    if (!title) {
      setTopicMutationError(copy.topicTitleRequired);
      return;
    }

    const selectedStage = stageById.get(stageId);
    if (!selectedStage) {
      setTopicMutationError(copy.topicStageRequired);
      return;
    }
    const fallbackPosition = (selectedStage?.topics.length ?? 0) + 1;
    const position = parsePositiveInteger(topicCreateDraft.position, fallbackPosition);

    setTopicMutationError(null);
    setIsTopicCreating(true);
    try {
      await createRoadmapTopic({
        stageId,
        title,
        description: topicCreateDraft.description.trim(),
        position
      });
      setTopicCreateDraft((current) => ({
        stageId,
        title: "",
        description: "",
        position: String(parsePositiveInteger(current.position, fallbackPosition) + 1)
      }));
      roadmap.reload();
    } catch (error) {
      setTopicMutationError(error instanceof Error ? error.message : copy.topicCreateFailed);
    } finally {
      setIsTopicCreating(false);
    }
  }

  async function handleStageCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = stageCreateDraft.title.trim();
    if (!title) {
      setStageMutationSuccess(null);
      setStageMutationError(copy.stageTitleRequired);
      return;
    }

    const fallbackPosition = stages.length + 1;
    const position = parsePositiveInteger(stageCreateDraft.position, fallbackPosition);

    setStageMutationError(null);
    setStageMutationSuccess(null);
    setIsStageCreating(true);
    try {
      await createRoadmapStage({
        title,
        position
      });
      setStageCreateDraft({
        title: "",
        position: String(position + 1)
      });
      setStageMutationSuccess(copy.stageCreateSuccess);
      roadmap.reload();
    } catch (error) {
      setStageMutationError(error instanceof Error ? error.message : copy.stageCreateFailed);
    } finally {
      setIsStageCreating(false);
    }
  }

  function startStageEditing(stage: (typeof stages)[number], fallbackPosition: number) {
    setEditingStageId(stage.id);
    setStageEditDraft({
      stageId: stage.id,
      title: stage.title,
      position: String(fallbackPosition)
    });
    setStageMutationError(null);
    setStageMutationSuccess(null);
  }

  function cancelStageEditing() {
    setEditingStageId(null);
    setStageEditDraft(null);
  }

  async function handleStageUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingStageId || !stageEditDraft || stageEditDraft.stageId !== editingStageId) {
      return;
    }

    const title = stageEditDraft.title.trim();
    if (!title) {
      setStageMutationSuccess(null);
      setStageMutationError(copy.stageTitleRequired);
      return;
    }

    const stageIndex = stages.findIndex((stage) => stage.id === editingStageId);
    const fallbackPosition = stageIndex >= 0 ? stageIndex + 1 : 1;
    const position = parsePositiveInteger(stageEditDraft.position, fallbackPosition);

    setStageMutationError(null);
    setStageMutationSuccess(null);
    setUpdatingStageId(editingStageId);
    try {
      await updateRoadmapStage(editingStageId, {
        title,
        position
      });
      cancelStageEditing();
      setStageMutationSuccess(copy.stageUpdateSuccess);
      roadmap.reload();
    } catch (error) {
      setStageMutationError(error instanceof Error ? error.message : copy.stageUpdateFailed);
    } finally {
      setUpdatingStageId(null);
    }
  }

  async function handleStageDelete(stage: (typeof stages)[number]) {
    if (!window.confirm(copy.stageDeleteConfirm(stage.title))) {
      return;
    }

    setStageMutationError(null);
    setStageMutationSuccess(null);
    setDeletingStageId(stage.id);
    try {
      await deleteRoadmapStage(stage.id);
      if (editingStageId === stage.id) {
        cancelStageEditing();
      }
      setStageMutationSuccess(copy.stageDeleteSuccess);
      roadmap.reload();
    } catch (error) {
      setStageMutationError(error instanceof Error ? error.message : copy.stageDeleteFailed);
    } finally {
      setDeletingStageId(null);
    }
  }

  function startTopicEditing(topic: RoadmapTopic) {
    setEditingTopicId(topic.id);
    setTopicEditDraft({
      topicId: topic.id,
      stageId: topic.stageId,
      title: topic.title,
      description: topic.description,
      position: String(topic.position)
    });
    setTopicMutationError(null);
  }

  function cancelTopicEditing() {
    setEditingTopicId(null);
    setTopicEditDraft(null);
  }

  async function handleTopicUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTopicId || !topicEditDraft || topicEditDraft.topicId !== editingTopicId) {
      return;
    }

    const stageId = topicEditDraft.stageId.trim();
    const title = topicEditDraft.title.trim();
    if (!stageId) {
      setTopicMutationError(copy.topicStageRequired);
      return;
    }
    if (!title) {
      setTopicMutationError(copy.topicTitleRequired);
      return;
    }

    const selectedStage = stageById.get(stageId);
    if (!selectedStage) {
      setTopicMutationError(copy.topicStageRequired);
      return;
    }
    const currentTopic = topicById.get(editingTopicId) ?? null;
    const fallbackPosition =
      currentTopic && selectedStage && currentTopic.stageId === selectedStage.id
        ? currentTopic.position
        : (selectedStage?.topics.length ?? 0) + 1;
    const position = parsePositiveInteger(topicEditDraft.position, Math.max(fallbackPosition, 1));

    setTopicMutationError(null);
    setUpdatingTopicId(editingTopicId);
    try {
      await updateRoadmapTopic(editingTopicId, {
        stageId,
        title,
        description: topicEditDraft.description.trim(),
        position
      });
      cancelTopicEditing();
      roadmap.reload();
    } catch (error) {
      setTopicMutationError(error instanceof Error ? error.message : copy.topicUpdateFailed);
    } finally {
      setUpdatingTopicId(null);
    }
  }

  async function handleTopicDelete(topic: RoadmapTopic) {
    if (!window.confirm(copy.topicDeleteConfirm(topic.title))) {
      return;
    }

    setTopicMutationError(null);
    setDeletingTopicId(topic.id);
    try {
      await deleteRoadmapTopic(topic.id);
      if (editingTopicId === topic.id) {
        cancelTopicEditing();
      }
      roadmap.reload();
    } catch (error) {
      setTopicMutationError(error instanceof Error ? error.message : copy.topicDeleteFailed);
    } finally {
      setDeletingTopicId(null);
    }
  }

  async function handleDependencyCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const topicId = dependencyDraft.topicId.trim();
    const prerequisiteTopicId = dependencyDraft.prerequisiteTopicId.trim();
    if (!topicId) {
      setDependencyMutationError(copy.dependencyTopicRequired);
      return;
    }
    if (!prerequisiteTopicId) {
      setDependencyMutationError(copy.dependencyPrerequisiteRequired);
      return;
    }

    setDependencyMutationError(null);
    setIsDependencyCreating(true);
    try {
      await createRoadmapDependency({
        topicId,
        prerequisiteTopicId
      });
      roadmap.reload();
    } catch (error) {
      setDependencyMutationError(getDependencyErrorMessage(error, copy));
    } finally {
      setIsDependencyCreating(false);
    }
  }

  async function handleDependencyDelete(topicId: string, dependencyTopicId: string) {
    const key = `${topicId}:${dependencyTopicId}`;
    setDependencyMutationError(null);
    setRemovingDependencyKey(key);

    try {
      await deleteRoadmapDependency(topicId, dependencyTopicId);
      roadmap.reload();
    } catch (error) {
      setDependencyMutationError(
        error instanceof Error ? error.message : copy.dependencyRemoveFailed
      );
    } finally {
      setRemovingDependencyKey(null);
    }
  }

  return (
    <section className="roadmap-view">
      <header className="roadmap-header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
      </header>

      {roadmap.state.status === "loading" ? (
        <div className="panel roadmap-loading-panel">
          <p className="roadmap-loading-title">{copy.loadingTitle}</p>
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}

      {roadmap.state.status === "error" ? (
        <div className="panel roadmap-error-panel">
          <div className="dashboard-error">
            <p>{roadmap.state.errorMessage ?? copy.errorFallback}</p>
            <button
              type="button"
              className="button button-outline dashboard-retry"
              onClick={roadmap.reload}
            >
              {copy.retry}
            </button>
          </div>
        </div>
      ) : null}

      {roadmap.state.status === "success" ? (
        stages.length > 0 ? (
          <>
            <section className="panel roadmap-stage-mutation-panel">
              <header>
                <h3>{copy.stageManageTitle}</h3>
                <p>{copy.stageManageSubtitle}</p>
              </header>

              <form className="roadmap-stage-form" onSubmit={handleStageCreate}>
                <label className="roadmap-topic-field roadmap-topic-field-title">
                  <span>{copy.stageFieldTitle}</span>
                  <input
                    type="text"
                    className="input"
                    value={stageCreateDraft.title}
                    onChange={(event) =>
                      setStageCreateDraft((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    placeholder={copy.stageTitlePlaceholder}
                  />
                </label>

                <label className="roadmap-topic-field">
                  <span>{copy.stageFieldPosition}</span>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={stageCreateDraft.position}
                    onChange={(event) =>
                      setStageCreateDraft((current) => ({
                        ...current,
                        position: event.target.value
                      }))
                    }
                  />
                </label>

                <button type="submit" className="button button-primary" disabled={isStageCreating}>
                  {isStageCreating ? copy.stageCreatingButton : copy.stageCreateButton}
                </button>
              </form>
            </section>

            <section className="panel roadmap-topic-mutation-panel">
              <header>
                <h3>{copy.topicCreateTitle}</h3>
                <p>{copy.topicCreateSubtitle}</p>
              </header>

              <form className="roadmap-topic-form" onSubmit={handleTopicCreate}>
                <label className="roadmap-topic-field">
                  <span>{copy.topicFieldStage}</span>
                  <select
                    className="input"
                    value={topicCreateDraft.stageId}
                    onChange={(event) => {
                      const stageId = event.target.value;
                      const selectedStage = stageById.get(stageId);
                      setTopicCreateDraft((current) => ({
                        ...current,
                        stageId,
                        position: String((selectedStage?.topics.length ?? 0) + 1)
                      }));
                    }}
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="roadmap-topic-field roadmap-topic-field-title">
                  <span>{copy.topicFieldTitle}</span>
                  <input
                    type="text"
                    className="input"
                    value={topicCreateDraft.title}
                    onChange={(event) =>
                      setTopicCreateDraft((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    placeholder={copy.topicTitlePlaceholder}
                  />
                </label>

                <label className="roadmap-topic-field">
                  <span>{copy.topicFieldPosition}</span>
                  <input
                    type="number"
                    min={1}
                    className="input"
                    value={topicCreateDraft.position}
                    onChange={(event) =>
                      setTopicCreateDraft((current) => ({
                        ...current,
                        position: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="roadmap-topic-field roadmap-topic-field-description">
                  <span>{copy.topicFieldDescription}</span>
                  <textarea
                    value={topicCreateDraft.description}
                    onChange={(event) =>
                      setTopicCreateDraft((current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                    placeholder={copy.topicDescriptionPlaceholder}
                  />
                </label>

                <button type="submit" className="button button-primary" disabled={isTopicCreating}>
                  {isTopicCreating ? copy.topicCreatingButton : copy.topicCreateButton}
                </button>
              </form>
            </section>

            <section className="panel roadmap-dependency-mutation-panel">
              <header>
                <h3>{copy.dependencyManageTitle}</h3>
                <p>{copy.dependencyManageSubtitle}</p>
              </header>

              <form className="roadmap-dependency-form" onSubmit={handleDependencyCreate}>
                <label className="roadmap-topic-field">
                  <span>{copy.dependencyTopicLabel}</span>
                  <select
                    className="input"
                    value={dependencyDraft.topicId}
                    onChange={(event) =>
                      setDependencyDraft((current) => ({
                        ...current,
                        topicId: event.target.value
                      }))
                    }
                  >
                    {allTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="roadmap-topic-field">
                  <span>{copy.dependencyPrerequisiteLabel}</span>
                  <select
                    className="input"
                    value={dependencyDraft.prerequisiteTopicId}
                    onChange={(event) =>
                      setDependencyDraft((current) => ({
                        ...current,
                        prerequisiteTopicId: event.target.value
                      }))
                    }
                  >
                    {allTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={isDependencyCreating || allTopics.length < 2}
                >
                  {isDependencyCreating ? copy.dependencyAddingButton : copy.dependencyAddButton}
                </button>
              </form>
            </section>

            {topicMutationError ? (
              <div className="dashboard-error">
                <p>{topicMutationError}</p>
              </div>
            ) : null}

            {stageMutationError ? (
              <div className="dashboard-error">
                <p>{stageMutationError}</p>
              </div>
            ) : null}

            {stageMutationSuccess ? (
              <div className="dashboard-success">
                <p>{stageMutationSuccess}</p>
              </div>
            ) : null}

            {dependencyMutationError ? (
              <div className="dashboard-error">
                <p>{dependencyMutationError}</p>
              </div>
            ) : null}

            <div className="roadmap-stage-strip" aria-label={copy.stageAria}>
              {stages.map((stage, index) => (
                <div key={stage.id} className="roadmap-stage-pill">
                  <span>{stage.title}</span>
                  <strong>{stage.topics.length}</strong>

                  <div className="roadmap-stage-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={
                        isStageCreating || updatingStageId === stage.id || deletingStageId === stage.id
                      }
                      onClick={() => startStageEditing(stage, index + 1)}
                    >
                      {copy.stageEditButton}
                    </button>
                    <button
                      type="button"
                      className="button button-outline roadmap-stage-delete-button"
                      disabled={
                        isStageCreating || updatingStageId === stage.id || deletingStageId === stage.id
                      }
                      onClick={() => {
                        void handleStageDelete(stage);
                      }}
                    >
                      {deletingStageId === stage.id ? copy.stageDeletingButton : copy.stageDeleteButton}
                    </button>
                  </div>

                  {editingStageId === stage.id && stageEditDraft ? (
                    <form className="roadmap-stage-edit-form" onSubmit={handleStageUpdate}>
                      <label className="roadmap-topic-field roadmap-topic-field-title">
                        <span>{copy.stageFieldTitle}</span>
                        <input
                          type="text"
                          className="input"
                          value={stageEditDraft.title}
                          onChange={(event) =>
                            setStageEditDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    title: event.target.value
                                  }
                                : current
                            )
                          }
                        />
                      </label>

                      <label className="roadmap-topic-field">
                        <span>{copy.stageFieldPosition}</span>
                        <input
                          type="number"
                          min={1}
                          className="input"
                          value={stageEditDraft.position}
                          onChange={(event) =>
                            setStageEditDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    position: event.target.value
                                  }
                                : current
                            )
                          }
                        />
                      </label>

                      <div className="roadmap-stage-edit-actions">
                        <button
                          type="submit"
                          className="button button-primary"
                          disabled={updatingStageId === stage.id}
                        >
                          {updatingStageId === stage.id ? copy.stageUpdatingButton : copy.stageSaveButton}
                        </button>
                        <button
                          type="button"
                          className="button button-outline"
                          disabled={updatingStageId === stage.id}
                          onClick={cancelStageEditing}
                        >
                          {copy.stageCancelButton}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="roadmap-graph" ref={graphRef}>
              <svg
                className="roadmap-connections"
                viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="roadmap-arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#c2d2ef" />
                  </marker>
                </defs>
                {connections.map((connection) => (
                  <path
                    key={`${connection.fromId}-${connection.toId}`}
                    className="roadmap-connection"
                    d={`M ${connection.x1} ${connection.y1} C ${connection.x1 + 38} ${connection.y1}, ${connection.x2 - 38} ${connection.y2}, ${connection.x2} ${connection.y2}`}
                    markerEnd="url(#roadmap-arrowhead)"
                  />
                ))}
              </svg>

              <div className="roadmap-stage-columns">
                {stages.map((stage) => (
                  <section key={stage.id} className="roadmap-stage-column">
                    <header className="roadmap-stage-header">
                      <h3>{stage.title}</h3>
                      <p>{copy.topicsCount(stage.topics.length)}</p>
                    </header>

                    <ul className="roadmap-topic-list">
                      {stage.topics.map((topic) => (
                        <li key={topic.id}>
                          <article
                            ref={(element) => setTopicElement(topic.id, element)}
                            className={
                              topic.isBlocked
                                ? "roadmap-topic-card roadmap-topic-card-blocked"
                                : "roadmap-topic-card"
                            }
                            role="link"
                            tabIndex={0}
                            onClick={() =>
                              router.push(`/topics?topicId=${encodeURIComponent(topic.id)}`)
                            }
                            onKeyDown={(event) => onTopicKeyDown(event, topic.id)}
                            aria-label={copy.topicOpenAria(topic.title)}
                          >
                            <div className="roadmap-topic-top">
                              <span
                                className={`roadmap-status-badge ${getStatusClassName(topic.status)}`}
                              >
                                {getStatusLabel(topic.status, language)}
                              </span>
                              {topic.isBlocked ? (
                                <span className="roadmap-blocked-badge">{copy.blocked}</span>
                              ) : null}
                            </div>

                            <h4 className="roadmap-topic-title">{topic.title}</h4>
                            <p className="roadmap-topic-description">{topic.description}</p>

                            <div className="roadmap-topic-progress">
                              <div className="roadmap-progress-row">
                                <span>{copy.progress}</span>
                                <strong>{topic.progressPercent}%</strong>
                              </div>
                              <div className="roadmap-progress-track">
                                <span
                                  className="roadmap-progress-fill"
                                  style={{ width: `${topic.progressPercent}%` }}
                                />
                              </div>
                            </div>

                            <div className="roadmap-topic-counters">
                              <span>{copy.tasksCount(topic.tasksCount)}</span>
                              <span>{copy.materialsCount(topic.materialsCount)}</span>
                            </div>

                            {topic.isBlocked && topic.blockedReason ? (
                              <p className="roadmap-blocked-reason">{topic.blockedReason}</p>
                            ) : null}

                            {topic.prerequisiteTopicIds.length > 0 ? (
                              <div className="roadmap-prerequisites">
                                <p>{copy.prerequisites}</p>
                                <ul className="roadmap-prerequisite-list">
                                  {topic.prerequisiteTopicIds.map((dependencyId) => (
                                    <li key={dependencyId} className="roadmap-prerequisite-chip">
                                      <span>{topicById.get(dependencyId)?.title ?? dependencyId}</span>
                                      <button
                                        type="button"
                                        className="roadmap-prerequisite-remove"
                                        disabled={
                                          removingDependencyKey === `${topic.id}:${dependencyId}`
                                        }
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          void handleDependencyDelete(topic.id, dependencyId);
                                        }}
                                      >
                                        {removingDependencyKey === `${topic.id}:${dependencyId}`
                                          ? copy.dependencyRemovingButton
                                          : copy.dependencyRemoveButton}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            <div
                              className="roadmap-topic-actions"
                              onClick={stopTopicCardEvent}
                              onKeyDown={stopTopicCardEvent}
                            >
                              <button
                                type="button"
                                className="button button-outline"
                                disabled={
                                  isTopicCreating ||
                                  updatingTopicId === topic.id ||
                                  deletingTopicId === topic.id
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  startTopicEditing(topic);
                                }}
                              >
                                {copy.topicEditButton}
                              </button>
                              <button
                                type="button"
                                className="button button-outline roadmap-topic-delete-button"
                                disabled={
                                  isTopicCreating ||
                                  updatingTopicId === topic.id ||
                                  deletingTopicId === topic.id
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  void handleTopicDelete(topic);
                                }}
                              >
                                {deletingTopicId === topic.id
                                  ? copy.topicDeletingButton
                                  : copy.topicDeleteButton}
                              </button>
                            </div>

                            {editingTopicId === topic.id && topicEditDraft ? (
                              <form
                                className="roadmap-topic-edit-form"
                                onSubmit={handleTopicUpdate}
                                onClick={stopTopicCardEvent}
                                onKeyDown={stopTopicCardEvent}
                              >
                                <label className="roadmap-topic-field">
                                  <span>{copy.topicFieldStage}</span>
                                  <select
                                    className="input"
                                    value={topicEditDraft.stageId}
                                    onChange={(event) =>
                                      setTopicEditDraft((current) =>
                                        current
                                          ? {
                                              ...current,
                                              stageId: event.target.value
                                            }
                                          : current
                                      )
                                    }
                                  >
                                    {stages.map((stage) => (
                                      <option key={stage.id} value={stage.id}>
                                        {stage.title}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className="roadmap-topic-field roadmap-topic-field-title">
                                  <span>{copy.topicFieldTitle}</span>
                                  <input
                                    type="text"
                                    className="input"
                                    value={topicEditDraft.title}
                                    onChange={(event) =>
                                      setTopicEditDraft((current) =>
                                        current
                                          ? {
                                              ...current,
                                              title: event.target.value
                                            }
                                          : current
                                      )
                                    }
                                  />
                                </label>

                                <label className="roadmap-topic-field">
                                  <span>{copy.topicFieldPosition}</span>
                                  <input
                                    type="number"
                                    min={1}
                                    className="input"
                                    value={topicEditDraft.position}
                                    onChange={(event) =>
                                      setTopicEditDraft((current) =>
                                        current
                                          ? {
                                              ...current,
                                              position: event.target.value
                                            }
                                          : current
                                      )
                                    }
                                  />
                                </label>

                                <label className="roadmap-topic-field roadmap-topic-field-description">
                                  <span>{copy.topicFieldDescription}</span>
                                  <textarea
                                    value={topicEditDraft.description}
                                    onChange={(event) =>
                                      setTopicEditDraft((current) =>
                                        current
                                          ? {
                                              ...current,
                                              description: event.target.value
                                            }
                                          : current
                                      )
                                    }
                                  />
                                </label>

                                <div className="roadmap-topic-edit-actions">
                                  <button
                                    type="submit"
                                    className="button button-primary"
                                    disabled={updatingTopicId === topic.id}
                                  >
                                    {updatingTopicId === topic.id
                                      ? copy.topicUpdatingButton
                                      : copy.topicSaveButton}
                                  </button>
                                  <button
                                    type="button"
                                    className="button button-outline"
                                    disabled={updatingTopicId === topic.id}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      cancelTopicEditing();
                                    }}
                                  >
                                    {copy.topicCancelButton}
                                  </button>
                                </div>
                              </form>
                            ) : null}
                          </article>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            <footer className="roadmap-legend panel">
              <div className="roadmap-legend-items">
                <div className="roadmap-legend-item">
                  <span className="roadmap-legend-dot roadmap-legend-dot-completed" />
                  {copy.legendCompleted(statusCounters.completed)}
                </div>
                <div className="roadmap-legend-item">
                  <span className="roadmap-legend-dot roadmap-legend-dot-in-progress" />
                  {copy.legendInProgress(statusCounters.inProgress)}
                </div>
                <div className="roadmap-legend-item">
                  <span className="roadmap-legend-dot roadmap-legend-dot-blocked" />
                  {copy.legendBlocked(statusCounters.blocked)}
                </div>
              </div>
              <p className="roadmap-next-topic">
                {copy.nextAvailableTopic(nextTopic ? nextTopic.title : copy.noUnlockedTopics)}
              </p>
            </footer>
          </>
        ) : (
          <div className="panel roadmap-empty-panel">
            <p className="dashboard-empty">{copy.empty}</p>
            <section className="roadmap-quick-create">
              <header>
                <h3>{copy.quickCreateTitle}</h3>
                <p>{copy.quickCreateSubtitle}</p>
              </header>

              {quickCreateError ? (
                <div className="dashboard-error">
                  <p>{quickCreateError}</p>
                </div>
              ) : null}

              <form className="roadmap-quick-create-form" onSubmit={handleQuickCreate}>
                <label className="roadmap-quick-create-field">
                  <span>{copy.quickCreateTopicLabel}</span>
                  <input
                    type="text"
                    className="input"
                    value={quickCreateDraft.topicTitle}
                    onChange={(event) =>
                      setQuickCreateDraft((current) => ({
                        ...current,
                        topicTitle: event.target.value
                      }))
                    }
                    placeholder={copy.quickCreateTopicPlaceholder}
                  />
                </label>

                <label className="roadmap-quick-create-field roadmap-quick-create-field-description">
                  <span>{copy.quickCreateDescriptionLabel}</span>
                  <textarea
                    value={quickCreateDraft.topicDescription}
                    onChange={(event) =>
                      setQuickCreateDraft((current) => ({
                        ...current,
                        topicDescription: event.target.value
                      }))
                    }
                    placeholder={copy.quickCreateDescriptionPlaceholder}
                  />
                </label>

                <button type="submit" className="button button-primary" disabled={isQuickCreating}>
                  {isQuickCreating ? copy.quickCreatingButton : copy.quickCreateButton}
                </button>
              </form>
            </section>
          </div>
        )
      ) : null}
    </section>
  );
}
