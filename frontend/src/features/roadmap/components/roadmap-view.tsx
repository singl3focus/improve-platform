"use client";

import {
  FormEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@features/auth/lib/auth-fetch";
import { ExternalLink, MoreHorizontal, Pencil } from "lucide-react";
import { useRoadmapGraphLayout } from "@features/roadmap/hooks/use-roadmap-graph-layout";
import { RoadmapCreateForm } from "@features/roadmap/components/roadmap-create-form";
import { RoadmapSwitcher } from "@features/roadmap/components/roadmap-switcher";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import {
  buildConnectionPath,
  clampGraphScale,
  getRoadmapWheelZoomBehavior,
  getGraphOffsetForScale
} from "@features/roadmap/lib/roadmap-graph";
import { buildTopicGridPlacementById, compareTopicsByPosition } from "@features/roadmap/lib/roadmap-layout";
import {
  prepareRoadmapCreateSubmission,
  type RoadmapCreateDraft
} from "@features/roadmap/lib/roadmap-create";
import { prepareRoadmapTopicEditSubmission } from "@features/roadmap/lib/roadmap-topic-edit";
import { buildTopicCreatePayload } from "@features/roadmap/lib/roadmap-topic-create";
import {
  getRoadmapTopicStatuses,
  validateRoadmapTopicStatusChange
} from "@features/roadmap/lib/roadmap-topic-status";
import type { AppLanguage } from "@shared/i18n/ui-copy";
import type {
  RoadmapResponse,
  RoadmapType,
  RoadmapTopic,
  RoadmapTopicStatus
} from "@features/roadmap/types";

type RoadmapLoadStatus = "loading" | "success" | "error";

interface RoadmapState {
  status: RoadmapLoadStatus;
  data: RoadmapResponse | null;
  errorMessage: string | null;
  missingRoadmapId: string | null;
}

interface TopicCreateDraft {
  title: string;
  description: string;
}

interface TopicEditDraft {
  topicId: string;
  title: string;
  description: string;
  status: RoadmapTopicStatus;
}

interface ApiErrorDetails {
  message: string;
  code: string | null;
}

interface TopicCreateResult {
  topicId: string;
}

type TopicCreateDirection = "left" | "right" | "below";

const ROADMAP_MIN_SCALE = 0.6;
const ROADMAP_MAX_SCALE = 1.8;
const ROADMAP_MOBILE_BREAKPOINT = 960;

const ROADMAP_COPY = {
  ru: {
    title: "Дорожная карта обучения",
    subtitle: "Отслеживайте прогресс по этапам и связи между темами.",
    loadingTitle: "Загрузка roadmap...",
    retry: "Повторить",
    zoomIn: "Приблизить",
    zoomOut: "Отдалить",
    recenter: "Центр",
    fitAll: "Показать всё",
    errorFallback: "Не удалось загрузить roadmap.",
    stageAria: "Этапы roadmap",
    topicsCount: (count: number) => `${count} тем`,
    topicOpenAria: (title: string) => `${title}. Открыть детали темы.`,
    progress: "Прогресс",
    tasksCount: (count: number) => `${count} задач`,
    materialsCount: (count: number) => `${count} материалов`,
    legendCompleted: (count: number) => `Завершено (${count})`,
    legendInProgress: (count: number) => `В работе (${count})`,
    nextAvailableTopic: (value: string) => `Следующая тема: ${value}`,
    noUnlockedTopics: "Нет доступных тем.",
    empty: "В roadmap пока нет тем. Добавьте темы и зависимости, чтобы построить граф.",
    quickCreateTitle: "Быстрое создание первой темы",
    quickCreateSubtitle:
      "Создайте roadmap, этап и первую тему одним действием. Подробности можно изменить позже.",
    quickCreateTopicLabel: "Название темы",
    quickCreateTopicPlaceholder: "Например: основы HTML и CSS",
    quickCreateDescriptionLabel: "Описание темы",
    quickCreateDescriptionPlaceholder: "Коротко: что нужно изучить в этой теме",
    quickCreateButton: "Создать первую тему",
    quickCreatingButton: "Создание...",
    quickCreateTopicRequired: "Название первой темы обязательно.",
    quickCreateFailed: "Не удалось создать первую тему.",
    topicCreateTitle: "Добавить тему",
    topicCreateSubtitle: "Заполните данные темы и добавьте её в roadmap.",
    topicCreateDirectionTitle: (direction: TopicCreateDirection) => {
      if (direction === "left") {
        return "Добавить тему слева";
      }
      if (direction === "right") {
        return "Добавить тему справа";
      }
      return "Добавить тему ниже";
    },
    topicCreateDirectionSubtitle: (parentTitle: string, direction: TopicCreateDirection) => {
      if (direction === "left") {
        return `Новая тема будет показана слева от «${parentTitle}» и свяжется с текущей темой.`;
      }
      if (direction === "right") {
        return `Новая тема будет показана справа от «${parentTitle}» и свяжется с текущей темой.`;
      }
      return `Новая тема будет показана ниже «${parentTitle}» и свяжется с текущей темой.`;
    },
    topicFieldTitle: "Название",
    topicFieldDescription: "Описание",
    topicFieldStatus: "Статус",
    topicTitlePlaceholder: "Например: основы JavaScript",
    topicDescriptionPlaceholder: "Коротко: что будет внутри темы",
    topicCreateButton: "Добавить тему",
    topicCreatingButton: "Добавление...",
    topicCreateDirectionButton: (direction: TopicCreateDirection) => {
      if (direction === "left") {
        return "Создать слева";
      }
      if (direction === "right") {
        return "Создать справа";
      }
      return "Создать ниже";
    },
    topicCreatingDirectionButton: (direction: TopicCreateDirection) => {
      if (direction === "left") {
        return "Создание слева...";
      }
      if (direction === "right") {
        return "Создание справа...";
      }
      return "Создание ниже...";
    },
    topicEditButton: "Редактировать",
    topicDeleteButton: "Удалить",
    topicMenuAria: (title: string) => `Действия для темы «${title}»`,
    topicMenuCreateLeft: "Создать слева",
    topicMenuCreateRight: "Создать справа",
    topicMenuCreateBelow: "Создать ниже",
    topicCreateDependencyFailedAfterCreate:
      "Тема создана, но связь с родительской темой не сохранилась. Проверьте граф позже.",
    topicCreateCloseAria: "Закрыть окно добавления темы",
    topicEditCloseAria: "Закрыть окно редактирования темы",
    topicSaveButton: "Сохранить",
    topicCancelButton: "Отмена",
    topicUpdatingButton: "Сохранение...",
    topicDeletingButton: "Удаление...",
    topicStageRequired: "Выберите этап для темы.",
    topicTitleRequired: "Название темы обязательно.",
    topicCreateFailed: "Не удалось создать тему.",
    topicUpdateFailed: "Не удалось обновить тему.",
    topicDeleteFailed: "Не удалось удалить тему.",
    topicStatusInvalidTransition: (from: string, to: string, allowed: string) =>
      `Нельзя перевести тему из «${from}» в «${to}». Доступные статусы: ${allowed}.`,
    topicDeleteConfirm: (title: string) => `Удалить тему «${title}»?`,
    dependencyControlsAria: "Управление связями графа",
    dependencyRemoveEdgeAria: (fromTitle: string, toTitle: string) =>
      `Удалить связь: «${fromTitle}» -> «${toTitle}»`,
    dependencyRemoveButton: "Удалить связь",
    dependencyRemovingButton: "Удаление...",
    dependencyRemoveFailed: "Не удалось удалить зависимость.",
    defaultRoadmapTitle: "План обучения",
    defaultStageTitle: "Этап 1"
  },
  en: {
    title: "Learning roadmap",
    subtitle: "Track stage-by-stage progress and follow links between topics.",
    loadingTitle: "Loading roadmap graph...",
    retry: "Retry",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    recenter: "Recenter",
    fitAll: "Fit all",
    errorFallback: "Roadmap failed to load.",
    stageAria: "Roadmap stages",
    topicsCount: (count: number) => `${count} topics`,
    topicOpenAria: (title: string) => `${title}. Open topic details.`,
    progress: "Progress",
    tasksCount: (count: number) => `${count} tasks`,
    materialsCount: (count: number) => `${count} materials`,
    legendCompleted: (count: number) => `Completed (${count})`,
    legendInProgress: (count: number) => `In progress (${count})`,
    nextAvailableTopic: (value: string) => `Next topic: ${value}`,
    noUnlockedTopics: "No pending topics.",
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
    topicCreateTitle: "Add topic",
    topicCreateSubtitle: "Create a new topic in your current roadmap.",
    topicCreateDirectionTitle: (direction: TopicCreateDirection) => {
      if (direction === "left") {
        return "Create topic on the left";
      }
      if (direction === "right") {
        return "Create topic on the right";
      }
      return "Create topic below";
    },
    topicCreateDirectionSubtitle: (parentTitle: string, direction: TopicCreateDirection) => {
      if (direction === "left") {
        return `The new topic will be created to the left of "${parentTitle}" with a link from the current topic.`;
      }
      if (direction === "right") {
        return `The new topic will be created to the right of "${parentTitle}" with a link from the current topic.`;
      }
      return `The new topic will be created below "${parentTitle}" with a link from the current topic.`;
    },
    topicFieldTitle: "Title",
    topicFieldDescription: "Description",
    topicFieldStatus: "Status",
    topicTitlePlaceholder: "For example: Working with forms",
    topicDescriptionPlaceholder: "Short note about what to learn in this topic",
    topicCreateButton: "Add topic",
    topicCreatingButton: "Adding...",
    topicCreateDirectionButton: (direction: TopicCreateDirection) => {
      if (direction === "left") {
        return "Create left";
      }
      if (direction === "right") {
        return "Create right";
      }
      return "Create below";
    },
    topicCreatingDirectionButton: (direction: TopicCreateDirection) => {
      if (direction === "left") {
        return "Creating left...";
      }
      if (direction === "right") {
        return "Creating right...";
      }
      return "Creating below...";
    },
    topicEditButton: "Edit",
    topicDeleteButton: "Delete",
    topicMenuAria: (title: string) => `Topic actions for "${title}"`,
    topicMenuCreateLeft: "Create left",
    topicMenuCreateRight: "Create right",
    topicMenuCreateBelow: "Create below",
    topicCreateDependencyFailedAfterCreate:
      "Topic was created, but parent auto-link failed. Link topics manually.",
    topicCreateCloseAria: "Close topic creation modal",
    topicEditCloseAria: "Close topic editing modal",
    topicSaveButton: "Save",
    topicCancelButton: "Cancel",
    topicUpdatingButton: "Saving...",
    topicDeletingButton: "Deleting...",
    topicStageRequired: "Choose a stage for the topic.",
    topicTitleRequired: "Topic title is required.",
    topicCreateFailed: "Topic creation failed.",
    topicUpdateFailed: "Topic update failed.",
    topicDeleteFailed: "Topic removal failed.",
    topicStatusInvalidTransition: (from: string, to: string, allowed: string) =>
      `Cannot move topic from "${from}" to "${to}". Allowed transitions: ${allowed}.`,
    topicDeleteConfirm: (title: string) => `Delete topic "${title}"?`,
    dependencyControlsAria: "Roadmap dependency controls",
    dependencyRemoveEdgeAria: (fromTitle: string, toTitle: string) =>
      `Remove dependency link: "${fromTitle}" -> "${toTitle}"`,
    dependencyRemoveButton: "Remove link",
    dependencyRemovingButton: "Removing...",
    dependencyRemoveFailed: "Dependency removal failed.",
    defaultRoadmapTitle: "Learning roadmap",
    defaultStageTitle: "Stage 1"
  }
} as const;

type RoadmapCopy = (typeof ROADMAP_COPY)[keyof typeof ROADMAP_COPY];

const ROADMAP_TYPE_META = {
  graph: {
    ru: {
      label: "Graph",
      badge: "Графовый roadmap",
      description: "Связанный граф тем и зависимостей.",
      emptyTitle: "Графовый roadmap пуст",
      emptyDescription: "Добавьте первую тему, чтобы построить граф зависимостей и начать заполнять карту.",
      firstItemAction: "Добавить первую тему"
    },
    en: {
      label: "Graph",
      badge: "Graph roadmap",
      description: "A connected graph of topics and dependencies.",
      emptyTitle: "Graph roadmap is empty",
      emptyDescription: "Add the first topic to start building the dependency graph.",
      firstItemAction: "Add first topic"
    }
  },
  levels: {
    ru: {
      label: "Levels",
      badge: "Levels roadmap",
      description: "Последовательные уровни развития с фокусом на следующий шаг.",
      emptyTitle: "Levels roadmap пуст",
      emptyDescription: "Добавьте первый уровень и затем выстраивайте последовательность освоения как ступени роста.",
      firstItemAction: "Добавить первый уровень"
    },
    en: {
      label: "Levels",
      badge: "Levels roadmap",
      description: "Sequential development levels with a clear next step.",
      emptyTitle: "Levels roadmap is empty",
      emptyDescription: "Add the first level and build the roadmap as a progression ladder.",
      firstItemAction: "Add first level"
    }
  },
  cycles: {
    ru: {
      label: "Cycles",
      badge: "Cycles roadmap",
      description: "Повторяющиеся циклы улучшения с обзором текущего витка.",
      emptyTitle: "Cycles roadmap пуст",
      emptyDescription: "Добавьте первый цикл и используйте roadmap как систему повторяемого улучшения.",
      firstItemAction: "Добавить первый цикл"
    },
    en: {
      label: "Cycles",
      badge: "Cycles roadmap",
      description: "Recurring improvement cycles with a focused current loop.",
      emptyTitle: "Cycles roadmap is empty",
      emptyDescription: "Add the first cycle and use the roadmap as a repeatable improvement system.",
      firstItemAction: "Add first cycle"
    }
  }
} as const;

function getRoadmapTypeBadge(type: RoadmapType, language: AppLanguage): string {
  return ROADMAP_TYPE_META[type][language].badge;
}

function getRoadmapTypeDescription(type: RoadmapType, language: AppLanguage): string {
  return ROADMAP_TYPE_META[type][language].description;
}

function getRoadmapEmptyTitle(type: RoadmapType, language: AppLanguage): string {
  return ROADMAP_TYPE_META[type][language].emptyTitle;
}

function getRoadmapEmptyDescription(type: RoadmapType, language: AppLanguage): string {
  return ROADMAP_TYPE_META[type][language].emptyDescription;
}

function getFirstRoadmapItemActionLabel(type: RoadmapType, language: AppLanguage): string {
  return ROADMAP_TYPE_META[type][language].firstItemAction;
}

function getNextRoadmapItemActionLabel(type: RoadmapType, language: AppLanguage): string {
  if (language === "ru") {
    if (type === "levels") {
      return "Добавить следующий уровень";
    }
    if (type === "cycles") {
      return "Добавить следующий цикл";
    }
    return "Добавить тему";
  }

  if (type === "levels") {
    return "Add next level";
  }
  if (type === "cycles") {
    return "Add next cycle";
  }
  return "Add topic";
}

function getRoadmapStructuredOpenLabel(type: RoadmapType, language: AppLanguage): string {
  if (language === "ru") {
    if (type === "levels") {
      return "Открыть уровень";
    }
    if (type === "cycles") {
      return "Открыть цикл";
    }
    return "Открыть тему";
  }

  if (type === "levels") {
    return "Open level";
  }
  if (type === "cycles") {
    return "Open cycle";
  }
  return "Open topic";
}

function getRoadmapItemCreateTitle(type: RoadmapType, language: AppLanguage): string {
  if (language === "ru") {
    if (type === "levels") {
      return "Добавить уровень";
    }
    if (type === "cycles") {
      return "Добавить цикл";
    }
    return "Добавить тему";
  }

  if (type === "levels") {
    return "Add level";
  }
  if (type === "cycles") {
    return "Add cycle";
  }
  return "Add topic";
}

function getRoadmapItemCreateSubtitle(type: RoadmapType, language: AppLanguage): string {
  if (language === "ru") {
    if (type === "levels") {
      return "Создайте новый уровень в текущем roadmap и продолжите последовательность освоения.";
    }
    if (type === "cycles") {
      return "Создайте новый цикл в текущем roadmap.";
    }
    return "Создайте новую тему в текущем roadmap.";
  }

  if (type === "levels") {
    return "Create a new level in the current roadmap and continue the learning sequence.";
  }
  if (type === "cycles") {
    return "Create a new cycle in the current roadmap.";
  }
  return "Create a new topic in your current roadmap.";
}

function getRoadmapItemSubmitLabel(type: RoadmapType, language: AppLanguage): string {
  if (language === "ru") {
    if (type === "levels") {
      return "Добавить уровень";
    }
    if (type === "cycles") {
      return "Добавить цикл";
    }
    return "Добавить тему";
  }

  if (type === "levels") {
    return "Add level";
  }
  if (type === "cycles") {
    return "Add cycle";
  }
  return "Add topic";
}

function getRoadmapItemSubmittingLabel(type: RoadmapType, language: AppLanguage): string {
  if (language === "ru") {
    if (type === "levels") {
      return "Добавление уровня...";
    }
    if (type === "cycles") {
      return "Добавление цикла...";
    }
    return "Добавление...";
  }

  if (type === "levels") {
    return "Adding level...";
  }
  if (type === "cycles") {
    return "Adding cycle...";
  }
  return "Adding...";
}

async function fetchRoadmap(roadmapId: string, signal: AbortSignal): Promise<RoadmapResponse> {
  const response = await authFetch(`/api/roadmaps/${encodeURIComponent(roadmapId)}`, {
    method: "GET",
    signal
  });

  if (!response.ok) {
    throw createErrorWithCode(
      await parseErrorDetails(response, `Roadmap request failed (${response.status})`)
    );
  }

  return (await response.json()) as RoadmapResponse;
}

function initialRoadmapCreateDraft(): RoadmapCreateDraft {
  return {
    title: "",
    type: "graph"
  };
}

function initialTopicCreateDraft(): TopicCreateDraft {
  return {
    title: "",
    description: ""
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
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function getTopicStatusErrorMessage(
  validationResult: ReturnType<typeof validateRoadmapTopicStatusChange>,
  topic: Pick<RoadmapTopic, "status">,
  nextStatus: RoadmapTopicStatus,
  copy: RoadmapCopy,
  language: AppLanguage
): string {
  if (validationResult.ok) {
    return "";
  }

  return copy.topicStatusInvalidTransition(
    getStatusLabel(topic.status, language),
    getStatusLabel(nextStatus, language),
    validationResult.allowedStatuses.map((status) => getStatusLabel(status, language)).join(", ")
  );
}

async function createRoadmap(payload: {
  title: string;
  type: RoadmapType;
}): Promise<string> {
  const roadmapResponse = await authFetch("/api/roadmaps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!roadmapResponse.ok) {
    throw new Error(await parseErrorMessage(roadmapResponse, "Roadmap creation failed."));
  }

  const roadmapData = await roadmapResponse.json();
  const newRoadmapId: string = roadmapData.id ?? roadmapData.data?.id;
  if (!newRoadmapId) {
    throw new Error("Roadmap created but id is missing in response.");
  }

  return newRoadmapId;
}

async function createRoadmapTopic(roadmapId: string, payload: {
  title: string;
  description: string;
  direction?: TopicCreateDirection;
  relative_to_topic_id?: string;
  position?: number;
}): Promise<TopicCreateResult> {
  const response = await authFetch(`/api/roadmaps/${encodeURIComponent(roadmapId)}/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap topic creation failed."));
  }

  const payloadData = (await response.json()) as unknown;
  if (payloadData && typeof payloadData === "object") {
    const maybeId = (payloadData as { id?: unknown }).id;
    if (typeof maybeId === "string" && maybeId.length > 0) {
      return { topicId: maybeId };
    }

    const nestedTopicId =
      (payloadData as { topic?: { id?: unknown } }).topic?.id ??
      (payloadData as { data?: { id?: unknown } }).data?.id;
    if (typeof nestedTopicId === "string" && nestedTopicId.length > 0) {
      return { topicId: nestedTopicId };
    }
  }

  throw new Error("Roadmap topic creation succeeded, but topic id is missing in response.");
}

async function updateRoadmapTopic(
  roadmapId: string,
  topicId: string,
  payload: {
    title: string;
    description: string;
    status: RoadmapTopicStatus;
  }
): Promise<void> {
  const response = await authFetch(`/api/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}`, {
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

async function deleteRoadmapTopic(roadmapId: string, topicId: string): Promise<void> {
  const response = await authFetch(`/api/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "Roadmap topic removal failed."));
  }
}

async function deleteRoadmapDependency(roadmapId: string, topicId: string, dependencyTopicId: string): Promise<void> {
  const response = await authFetch(
    `/api/roadmaps/${encodeURIComponent(roadmapId)}/topics/${encodeURIComponent(topicId)}/dependencies/${encodeURIComponent(
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

function useRoadmapData(roadmapId: string | null, errorFallback: string) {
  const roadmapQuery = useQuery({
    queryKey: ["roadmap", roadmapId],
    queryFn: ({ signal }) => fetchRoadmap(roadmapId!, signal),
    enabled: Boolean(roadmapId),
    retry: false
  });

  if (!roadmapId) {
    return {
      state: {
        status: "success",
        data: null,
        errorMessage: null,
        missingRoadmapId: null
      } satisfies RoadmapState,
      reload: () => {
        void roadmapQuery.refetch();
      }
    };
  }

  if (roadmapQuery.isError && getErrorCode(roadmapQuery.error) === "roadmap_not_found") {
    return {
      state: {
        status: "success",
        data: null,
        errorMessage: null,
        missingRoadmapId: roadmapId
      } satisfies RoadmapState,
      reload: () => {
        void roadmapQuery.refetch();
      }
    };
  }

  return {
    state: {
      status: roadmapQuery.isPending ? "loading" : roadmapQuery.isError ? "error" : "success",
      data: roadmapQuery.data ?? null,
      errorMessage:
        roadmapQuery.isError && !(getErrorCode(roadmapQuery.error) === "roadmap_not_found")
          ? roadmapQuery.error instanceof Error
            ? roadmapQuery.error.message
            : errorFallback
          : null,
      missingRoadmapId: null
    } satisfies RoadmapState,
    reload: () => {
      void roadmapQuery.refetch();
    }
  };
}

function TopicMutationPanel(props: {
  copy: RoadmapCopy;
  draft: TopicCreateDraft;
  error?: string | null;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  submitLoadingLabel?: string;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel?: () => void;
  titleInputRef?: { current: HTMLInputElement | null };
}) {
  return (
    <section className="panel roadmap-topic-mutation-panel">
      {props.error ? (
        <div className="dashboard-error roadmap-modal-error">
          <p>{props.error}</p>
        </div>
      ) : null}

      <form className="roadmap-topic-form" onSubmit={props.onSubmit}>
        <label className="roadmap-topic-field roadmap-topic-field-title">
          <span>{props.copy.topicFieldTitle}</span>
          <input
            ref={props.titleInputRef}
            type="text"
            className="input"
            value={props.draft.title}
            onChange={(event) => props.onTitleChange(event.target.value)}
            placeholder={props.copy.topicTitlePlaceholder}
          />
        </label>

        <label className="roadmap-topic-field roadmap-topic-field-description">
          <span>{props.copy.topicFieldDescription}</span>
          <textarea
            value={props.draft.description}
            onChange={(event) => props.onDescriptionChange(event.target.value)}
            placeholder={props.copy.topicDescriptionPlaceholder}
          />
        </label>

        <button type="submit" className="button button-primary" disabled={props.isSubmitting}>
          {props.isSubmitting
            ? (props.submitLoadingLabel ?? props.copy.topicCreatingButton)
            : (props.submitLabel ?? props.copy.topicCreateButton)}
        </button>
      </form>
    </section>
  );
}

function RoadmapTypePill(props: { type: RoadmapType; language: AppLanguage }) {
  return (
    <span className="roadmap-type-pill">
      {getRoadmapTypeBadge(props.type, props.language)}
    </span>
  );
}

function TypedRoadmapEmptyState(props: {
  type: RoadmapType;
  language: AppLanguage;
  onCreateFirst: (triggerElement: HTMLElement) => void;
  disabled: boolean;
}) {
  return (
    <div className="panel roadmap-empty-panel roadmap-empty-panel-typed">
      <RoadmapTypePill type={props.type} language={props.language} />
      <h3>{getRoadmapEmptyTitle(props.type, props.language)}</h3>
      <p className="dashboard-empty">{getRoadmapEmptyDescription(props.type, props.language)}</p>
      <button
        type="button"
        className="button button-primary"
        onClick={(event) => props.onCreateFirst(event.currentTarget)}
        disabled={props.disabled}
      >
        {getFirstRoadmapItemActionLabel(props.type, props.language)}
      </button>
    </div>
  );
}

function RoadmapCreateEntryState(props: {
  language: AppLanguage;
  createHref: string;
  onOpenCreate: () => void;
}) {
  return (
    <div className="panel roadmap-empty-panel roadmap-roadmap-create-entry">
      <h3>{props.language === "ru" ? "Создайте первую roadmap" : "Create your first roadmap"}</h3>
      <p className="dashboard-empty">
        {props.language === "ru"
          ? "Сначала создайте roadmap, а затем выберите её тип и название."
          : "Start by creating a roadmap, then choose its type and title."}
      </p>
      <a
        href={props.createHref}
        role="button"
        className="button button-primary roadmap-empty-create-button"
        onClick={(event) => {
          event.preventDefault();
          props.onOpenCreate();
        }}
      >
        {props.language === "ru" ? "Создать первую roadmap" : "Create first roadmap"}
      </a>
    </div>
  );
}

function LevelsRoadmapRenderer(props: {
  topics: RoadmapTopic[];
  copy: RoadmapCopy;
  language: AppLanguage;
  onEdit: (topic: RoadmapTopic, triggerElement: HTMLElement) => void;
  onOpenWorkspace: (topicId: string) => void;
  onCreateNext: (triggerElement: HTMLElement) => void;
}) {
  if (props.topics.length === 0) {
    return null;
  }

  return (
    <div className="roadmap-levels-layout">
      <div className="roadmap-levels-stack">
        {props.topics.map((topic, index) => {
          return (
            <article
              key={topic.id}
              className="roadmap-level-card roadmap-level-card-unified"
            >
              <div className="roadmap-level-card-topline">
                <span className="roadmap-level-index">
                  {props.language === "ru" ? `Уровень ${index + 1}` : `Level ${index + 1}`}
                </span>
                <span className={`roadmap-status-badge ${getStatusClassName(topic.status)}`}>
                  {getStatusLabel(topic.status, props.language)}
                </span>
              </div>
              <div className="roadmap-level-card-title">{topic.title}</div>
              <div className="roadmap-level-card-description">{topic.description}</div>

              <div className="roadmap-structured-progress">
                <div className="roadmap-progress-row">
                  <span>{props.copy.progress}</span>
                  <strong>{topic.progressPercent}%</strong>
                </div>
                <div className="roadmap-progress-track">
                  <span className="roadmap-progress-fill" style={{ width: `${topic.progressPercent}%` }} />
                </div>
              </div>

              <div className="roadmap-level-card-meta">
                <span>{props.copy.tasksCount(topic.tasksCount)}</span>
                <span>{props.copy.materialsCount(topic.materialsCount)}</span>
              </div>

              <div className="roadmap-structured-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={(event) => props.onEdit(topic, event.currentTarget)}
                >
                  {props.copy.topicEditButton}
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => props.onOpenWorkspace(topic.id)}
                >
                  <ExternalLink size={14} />
                  {getRoadmapStructuredOpenLabel("levels", props.language)}
                </button>
              </div>
            </article>
          );
        })}

        <div className="roadmap-level-create-card">
          <h3>{props.language === "ru" ? "Следующий уровень" : "Next level"}</h3>
          <p>
            {props.language === "ru"
              ? "Добавьте следующий уровень прямо в последовательность roadmap."
              : "Add the next level directly into the roadmap sequence."}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={(event) => props.onCreateNext(event.currentTarget)}
          >
            {getNextRoadmapItemActionLabel("levels", props.language)}
          </button>
        </div>
      </div>
    </div>
  );
}

function getCycleStageLabel(status: RoadmapTopicStatus, language: AppLanguage): string {
  const labels =
    language === "ru"
      ? ["План", "Делаю", "Отслеживаю", "Ревью", "Корректирую"]
      : ["Plan", "Do", "Track", "Review", "Adjust"];

  switch (status) {
    case "completed":
      return labels[3];
    case "in_progress":
      return labels[1];
    case "paused":
      return labels[2];
    default:
      return labels[0];
  }
}

function CyclesRoadmapRenderer(props: {
  topics: RoadmapTopic[];
  copy: RoadmapCopy;
  language: AppLanguage;
  onEdit: (topic: RoadmapTopic, triggerElement: HTMLElement) => void;
  onOpenWorkspace: (topicId: string) => void;
  onCreateNext: (triggerElement: HTMLElement) => void;
  onStatusChange: (topic: RoadmapTopic, status: RoadmapTopicStatus) => void;
  updatingTopicId: string | null;
}) {
  if (props.topics.length === 0) {
    return null;
  }

  return (
    <div className="roadmap-cycles-layout">
      <div className="roadmap-cycles-stack">
        {props.topics.map((topic) => {
          const loopLabels =
            props.language === "ru"
              ? ["План", "Делаю", "Отслеживаю", "Ревью", "Корректирую"]
              : ["Plan", "Do", "Track", "Review", "Adjust"];
          const activeStage = getCycleStageLabel(topic.status, props.language);
          return (
            <article
              key={topic.id}
              className="roadmap-cycle-card roadmap-cycle-card-unified"
            >
              <div className="roadmap-cycle-card-header">
                <div>
                  <div className="roadmap-cycle-card-title">{topic.title}</div>
                  <div className="roadmap-cycle-card-description">{topic.description}</div>
                </div>
                <span className="roadmap-cycle-stage">{getCycleStageLabel(topic.status, props.language)}</span>
              </div>

              <div className="roadmap-cycle-card-main">
                <div className="roadmap-cycle-wheel">
                  <div className="roadmap-cycle-wheel-ring" />
                  {loopLabels.map((label, index) => (
                    <div
                      key={`${topic.id}-${label}`}
                      className={`roadmap-cycle-wheel-step${label === activeStage ? " roadmap-cycle-wheel-step-active" : ""}`}
                      style={{ transform: `rotate(${index * 72}deg)` }}
                    >
                      <span>{label}</span>
                    </div>
                  ))}
                  <div className="roadmap-cycle-wheel-core">
                    <strong>{topic.progressPercent}%</strong>
                    <span>{props.language === "ru" ? "прогресс цикла" : "cycle progress"}</span>
                  </div>
                </div>

                <div className="roadmap-cycle-card-content">
                  <div className="roadmap-structured-progress">
                    <div className="roadmap-progress-row">
                      <span>{props.copy.progress}</span>
                      <strong>{topic.progressPercent}%</strong>
                    </div>
                    <div className="roadmap-progress-track">
                      <span className="roadmap-progress-fill" style={{ width: `${topic.progressPercent}%` }} />
                    </div>
                  </div>

                  <div className="roadmap-cycle-card-meta">
                    <span>{props.copy.tasksCount(topic.tasksCount)}</span>
                    <span>{props.copy.materialsCount(topic.materialsCount)}</span>
                  </div>

                  <div className="roadmap-cycle-status-block">
                    <span className="roadmap-cycle-status-label">
                      {props.language === "ru" ? "Статус цикла" : "Cycle status"}
                    </span>
                    <div className="roadmap-cycle-status-switcher" role="group" aria-label={props.copy.topicFieldStatus}>
                      {getRoadmapTopicStatuses().map((status) => (
                        <button
                          key={`${topic.id}-${status}`}
                          type="button"
                          className={`roadmap-cycle-status-button${
                            topic.status === status ? " roadmap-cycle-status-button-active" : ""
                          }`}
                          disabled={props.updatingTopicId === topic.id}
                          onClick={() => props.onStatusChange(topic, status)}
                        >
                          {getStatusLabel(status, props.language)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="roadmap-structured-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={(event) => props.onEdit(topic, event.currentTarget)}
                    >
                      {props.copy.topicEditButton}
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => props.onOpenWorkspace(topic.id)}
                    >
                      <ExternalLink size={14} />
                      {getRoadmapStructuredOpenLabel("cycles", props.language)}
                    </button>
                  </div>
                </div>
              </div>

            </article>
          );
        })}

        <div className="roadmap-level-create-card">
          <h3>{props.language === "ru" ? "Следующий цикл" : "Next cycle"}</h3>
          <p>
            {props.language === "ru"
              ? "Добавьте следующий цикл и продолжайте итерации в рамках roadmap."
              : "Add the next cycle and continue iterating inside the roadmap."}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={(event) => props.onCreateNext(event.currentTarget)}
          >
            {getNextRoadmapItemActionLabel("cycles", props.language)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoadmapView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, activeRoadmapId, setActiveRoadmapId } = useUserPreferences();
  const shouldOpenRoadmapCreatePanel = searchParams.get("create") === "1";
  const copy = ROADMAP_COPY[language];
  const roadmap = useRoadmapData(activeRoadmapId, copy.errorFallback);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const graphSceneRef = useRef<HTMLDivElement | null>(null);
  const topicRefs = useRef<Map<string, HTMLElement>>(new Map());
  const topicRefCallbacks = useRef<Map<string, (element: HTMLElement | null) => void>>(new Map());
  const topicCreateModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const topicModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const topicCreateModalTriggerRef = useRef<HTMLElement | null>(null);
  const topicModalTriggerRef = useRef<HTMLElement | null>(null);
  const panStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const panStartOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const pendingFirstTopicCenterRef = useRef(false);
  const transformFrameRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);
  const wheelCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sceneTransform, setSceneTransform] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  });
  const sceneTransformRef = useRef(sceneTransform);
  const [panPointerId, setPanPointerId] = useState<number | null>(null);
  const [isGraphInteracting, setIsGraphInteracting] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const { connections, graphSize } = useRoadmapGraphLayout({
    status: roadmap.state.status,
    data: roadmap.state.data,
    graphRef,
    sceneRef: graphSceneRef,
    topicRefs,
    transformRef: sceneTransformRef,
    layoutVersion
  });
  const [roadmapCreateDraft, setRoadmapCreateDraft] = useState<RoadmapCreateDraft>(initialRoadmapCreateDraft());
  const [roadmapCreateError, setRoadmapCreateError] = useState<string | null>(null);
  const [isRoadmapCreating, setIsRoadmapCreating] = useState(false);
  const [isRoadmapCreatePanelOpen, setIsRoadmapCreatePanelOpen] = useState(shouldOpenRoadmapCreatePanel);
  const [topicCreateDraft, setTopicCreateDraft] = useState<TopicCreateDraft>(initialTopicCreateDraft());
  const [topicEditDraft, setTopicEditDraft] = useState<TopicEditDraft | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicMutationError, setTopicMutationError] = useState<string | null>(null);
  const [isTopicCreating, setIsTopicCreating] = useState(false);
  const [isTopicCreateModalOpen, setIsTopicCreateModalOpen] = useState(false);
  const [updatingTopicId, setUpdatingTopicId] = useState<string | null>(null);
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  const [topicMenuTopicId, setTopicMenuTopicId] = useState<string | null>(null);
  const [topicCreateAnchor, setTopicCreateAnchor] = useState<{
    parentId: string;
    direction: TopicCreateDirection;
  } | null>(null);
  const [dependencyMutationError, setDependencyMutationError] = useState<string | null>(null);
  const [removingDependencyKey, setRemovingDependencyKey] = useState<string | null>(null);

  useEffect(() => {
    if (shouldOpenRoadmapCreatePanel) {
      setIsRoadmapCreatePanelOpen(true);
    }
  }, [shouldOpenRoadmapCreatePanel]);

  const applySceneTransform = useCallback(
    (
      nextTransform: { scale: number; offsetX: number; offsetY: number },
      options: { commit?: boolean } = {}
    ) => {
      sceneTransformRef.current = nextTransform;
      pendingTransformRef.current = nextTransform;

      if (transformFrameRef.current === null) {
        transformFrameRef.current = requestAnimationFrame(() => {
          const latestTransform = pendingTransformRef.current;
          transformFrameRef.current = null;
          pendingTransformRef.current = null;
          if (graphCanvasRef.current && latestTransform) {
            graphCanvasRef.current.style.transform = `translate3d(${latestTransform.offsetX}px, ${latestTransform.offsetY}px, 0) scale(${latestTransform.scale})`;
          }
        });
      }

      if (options.commit !== false) {
        setSceneTransform((current) =>
          current.scale === nextTransform.scale &&
          current.offsetX === nextTransform.offsetX &&
          current.offsetY === nextTransform.offsetY
            ? current
            : nextTransform
        );
      }
    },
    []
  );

  const scheduleCommittedSceneTransform = useCallback(() => {
    if (wheelCommitTimeoutRef.current) {
      clearTimeout(wheelCommitTimeoutRef.current);
    }

    wheelCommitTimeoutRef.current = setTimeout(() => {
      setSceneTransform(sceneTransformRef.current);
      wheelCommitTimeoutRef.current = null;
    }, 120);
  }, []);

  const markGraphInteraction = useCallback(() => {
    setIsGraphInteracting(true);
    if (interactionResetTimeoutRef.current) {
      clearTimeout(interactionResetTimeoutRef.current);
    }

    interactionResetTimeoutRef.current = setTimeout(() => {
      setIsGraphInteracting(false);
      interactionResetTimeoutRef.current = null;
    }, 180);
  }, []);

  const stages = useMemo(() => roadmap.state.data?.stages ?? [], [roadmap.state.data]);

  const topicById = useMemo(() => {
    const map = new Map<string, RoadmapTopic>();
    for (const stage of stages) {
      for (const topic of stage.topics) {
        map.set(topic.id, topic);
      }
    }
    return map;
  }, [stages]);

  const allTopics = useMemo(
    () =>
      stages.flatMap((stage) =>
        [...stage.topics].sort(compareTopicsByPosition)
      ),
    [stages]
  );
  const roadmapType = roadmap.state.data?.type ?? "graph";
  const hasActiveRoadmap = Boolean(activeRoadmapId && roadmap.state.data);
  const topicGridPlacementById = useMemo(() => buildTopicGridPlacementById(stages), [stages]);
  const maxGridColumns = useMemo(
    () => Math.max(...Array.from(topicGridPlacementById.values()).map((placement) => placement.column), 1),
    [topicGridPlacementById]
  );
  const topicCreateAnchorTopic = useMemo(
    () => (topicCreateAnchor ? topicById.get(topicCreateAnchor.parentId) ?? null : null),
    [topicCreateAnchor, topicById]
  );
  const editingTopic = useMemo(() => {
    if (!editingTopicId) {
      return null;
    }

    return topicById.get(editingTopicId) ?? null;
  }, [editingTopicId, topicById]);
  const statusCounters = useMemo(() => {
    return {
      completed: allTopics.filter((topic) => topic.status === "completed").length,
      inProgress: allTopics.filter((topic) => topic.status === "in_progress").length
    };
  }, [allTopics]);

  const nextTopic = useMemo(() => {
    return (
      allTopics.find(
        (topic) => topic.status === "not_started" || topic.status === "paused"
      ) ?? null
    );
  }, [allTopics]);
  const roadmapActionLabel =
    allTopics.length > 0
      ? getNextRoadmapItemActionLabel(roadmapType, language)
      : getFirstRoadmapItemActionLabel(roadmapType, language);

  useEffect(() => {
    applySceneTransform(sceneTransform, { commit: false });

    return () => {
      if (transformFrameRef.current) {
        cancelAnimationFrame(transformFrameRef.current);
      }
      if (wheelCommitTimeoutRef.current) {
        clearTimeout(wheelCommitTimeoutRef.current);
      }
      if (interactionResetTimeoutRef.current) {
        clearTimeout(interactionResetTimeoutRef.current);
      }
    };
  }, [applySceneTransform, sceneTransform]);

  useEffect(() => {
    if (activeRoadmapId && roadmap.state.missingRoadmapId === activeRoadmapId) {
      setActiveRoadmapId(null);
    }
  }, [activeRoadmapId, roadmap.state.missingRoadmapId, setActiveRoadmapId]);

  const updateSceneScale = useCallback((
    nextScaleCandidate: number,
    anchor: { x: number; y: number },
    options: { commit?: boolean } = {}
  ) => {
    const current = sceneTransformRef.current;
    const nextScale = clampGraphScale(nextScaleCandidate, ROADMAP_MIN_SCALE, ROADMAP_MAX_SCALE);
    if (nextScale === current.scale) {
      return;
    }

    const nextOffset = getGraphOffsetForScale(anchor, current, nextScale);
    applySceneTransform(
      {
        scale: nextScale,
        offsetX: nextOffset.x,
        offsetY: nextOffset.y
      },
      options
    );
  }, [applySceneTransform]);

  const recenterGraphScene = useCallback((targetScale?: number) => {
    const graphElement = graphRef.current;
    if (!graphElement || allTopics.length === 0) {
      return;
    }

    const nextScale = clampGraphScale(
      targetScale ?? sceneTransformRef.current.scale,
      ROADMAP_MIN_SCALE,
      ROADMAP_MAX_SCALE
    );

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const topic of allTopics) {
      const topicElement = topicRefs.current.get(topic.id);
      if (!topicElement) {
        continue;
      }

      const topicRect = topicElement.getBoundingClientRect();
      const graphRect = graphElement.getBoundingClientRect();
      const current = sceneTransformRef.current;
      const left = (topicRect.left - graphRect.left - current.offsetX) / current.scale;
      const top = (topicRect.top - graphRect.top - current.offsetY) / current.scale;
      const width = topicRect.width / current.scale;
      const height = topicRect.height / current.scale;

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + width);
      maxY = Math.max(maxY, top + height);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const viewportCenterX = graphElement.clientWidth / 2;
    const viewportCenterY = graphElement.clientHeight / 2;

    applySceneTransform({
      scale: nextScale,
      offsetX: viewportCenterX - centerX * nextScale,
      offsetY: viewportCenterY - centerY * nextScale
    });
  }, [allTopics, applySceneTransform]);

  const centerTopicInViewport = useCallback((topicId: string, targetScale?: number) => {
    const graphElement = graphRef.current;
    const topicElement = topicRefs.current.get(topicId);
    if (!graphElement || !topicElement) {
      return;
    }

    const nextScale = clampGraphScale(
      targetScale ?? sceneTransformRef.current.scale,
      ROADMAP_MIN_SCALE,
      ROADMAP_MAX_SCALE
    );
    const topicRect = topicElement.getBoundingClientRect();
    const graphRect = graphElement.getBoundingClientRect();
    const renderedCenter = {
      x: topicRect.left - graphRect.left + topicRect.width / 2,
      y: topicRect.top - graphRect.top + topicRect.height / 2
    };
    const current = sceneTransformRef.current;
    const worldCenter = {
      x: (renderedCenter.x - current.offsetX) / current.scale,
      y: (renderedCenter.y - current.offsetY) / current.scale
    };

    applySceneTransform({
      scale: nextScale,
      offsetX: graphElement.clientWidth / 2 - worldCenter.x * nextScale,
      offsetY: graphElement.clientHeight / 2 - worldCenter.y * nextScale
    });
  }, [applySceneTransform]);

  useEffect(() => {
    if (!editingTopicId) {
      return;
    }

    topicModalTitleInputRef.current?.focus();
  }, [editingTopicId]);

  useEffect(() => {
    if (!editingTopicId && !isTopicCreateModalOpen) {
      return;
    }

    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (editingTopicId) {
        setEditingTopicId(null);
        setTopicEditDraft(null);
        const trigger = topicModalTriggerRef.current;
        if (trigger && trigger.isConnected) {
          trigger.focus();
        }
        topicModalTriggerRef.current = null;
        return;
      }

      if (isTopicCreateModalOpen && !isTopicCreating) {
        setIsTopicCreateModalOpen(false);
        const trigger = topicCreateModalTriggerRef.current;
        if (trigger && trigger.isConnected) {
          trigger.focus();
        }
        topicCreateModalTriggerRef.current = null;
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    editingTopicId,
    isTopicCreateModalOpen,
    isTopicCreating
  ]);

  useEffect(() => {
    if (!topicMenuTopicId) {
      return;
    }

    const onWindowPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest(".roadmap-topic-menu")) {
        return;
      }

      setTopicMenuTopicId(null);
    };

    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setTopicMenuTopicId(null);
      }
    };

    window.addEventListener("pointerdown", onWindowPointerDown);
    window.addEventListener("keydown", onWindowKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onWindowPointerDown);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [topicMenuTopicId]);

  useEffect(() => {
    const graphElement = graphRef.current;
    if (!graphElement) {
      return;
    }

    // Native non-passive wheel listener is required here so desktop zoom
    // suppresses document scroll while the cursor stays inside the graph.
    const onGraphWheel = (event: WheelEvent) => {
      const behavior = getRoadmapWheelZoomBehavior(
        event.deltaY,
        window.innerWidth,
        ROADMAP_MOBILE_BREAKPOINT
      );
      if (!behavior.preventPageScroll) {
        return;
      }

      event.preventDefault();
      markGraphInteraction();
      const graphRect = graphElement.getBoundingClientRect();
      const anchor = {
        x: event.clientX - graphRect.left,
        y: event.clientY - graphRect.top
      };

      updateSceneScale(sceneTransformRef.current.scale + behavior.scaleDelta, anchor, {
        commit: false
      });
      scheduleCommittedSceneTransform();
    };

    graphElement.addEventListener("wheel", onGraphWheel, { passive: false });

    return () => {
      graphElement.removeEventListener("wheel", onGraphWheel);
    };
  }, [markGraphInteraction, roadmap.state.status, stages.length, scheduleCommittedSceneTransform, updateSceneScale]);

  useEffect(() => {
    if (!isTopicCreateModalOpen) {
      return;
    }

    topicCreateModalTitleInputRef.current?.focus();
  }, [isTopicCreateModalOpen]);

  useEffect(() => {
    if (panPointerId === null) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== panPointerId) {
        return;
      }

      const startPoint = panStartPointRef.current;
      const startOffset = panStartOffsetRef.current;
      if (!startPoint || !startOffset) {
        return;
      }

      markGraphInteraction();
      const nextOffsetX = startOffset.x + (event.clientX - startPoint.x);
      const nextOffsetY = startOffset.y + (event.clientY - startPoint.y);
      applySceneTransform({
        ...sceneTransformRef.current,
        offsetX: nextOffsetX,
        offsetY: nextOffsetY
      }, { commit: false });
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== panPointerId) {
        return;
      }

      setSceneTransform(sceneTransformRef.current);
      setPanPointerId(null);
      panStartPointRef.current = null;
      panStartOffsetRef.current = null;
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onSelectStart = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("selectstart", onSelectStart);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("selectstart", onSelectStart);
    };
  }, [applySceneTransform, markGraphInteraction, panPointerId]);

  useEffect(() => {
    if (!pendingFirstTopicCenterRef.current) {
      return;
    }

    if (roadmap.state.status !== "success" || allTopics.length !== 1) {
      return;
    }

    const firstTopicId = allTopics[0]?.id;
    if (!firstTopicId || !topicRefs.current.has(firstTopicId)) {
      const frame = requestAnimationFrame(() => {
        if (!pendingFirstTopicCenterRef.current) {
          return;
        }

        const delayedTopicId = allTopics[0]?.id;
        if (!delayedTopicId || !topicRefs.current.has(delayedTopicId)) {
          return;
        }

        centerTopicInViewport(delayedTopicId, 1);
        pendingFirstTopicCenterRef.current = false;
      });

      return () => cancelAnimationFrame(frame);
    }

    centerTopicInViewport(firstTopicId, 1);
    pendingFirstTopicCenterRef.current = false;
  }, [allTopics, centerTopicInViewport, roadmap.state.status]);

  function openTopicCreateModal(triggerElement: HTMLElement) {
    topicCreateModalTriggerRef.current = triggerElement;
    setTopicCreateAnchor(null);
    setTopicMenuTopicId(null);
    setTopicMutationError(null);
    setIsTopicCreateModalOpen(true);
  }

  function closeTopicCreateModal() {
    if (isTopicCreating) {
      return;
    }

    setIsTopicCreateModalOpen(false);
    setTopicMutationError(null);
    setTopicCreateAnchor(null);
    const trigger = topicCreateModalTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
    topicCreateModalTriggerRef.current = null;
  }

  function startDirectionalTopicCreate(
    parentTopic: RoadmapTopic,
    direction: TopicCreateDirection,
    triggerElement: HTMLElement
  ) {
    topicCreateModalTriggerRef.current = triggerElement;
    setTopicCreateDraft({
      title: "",
      description: ""
    });
    setTopicMutationError(null);
    setTopicMenuTopicId(null);
    setTopicCreateAnchor({
      parentId: parentTopic.id,
      direction
    });
    setIsTopicCreateModalOpen(true);
  }

  function openTopic(topicId: string) {
    router.push(`/topics?topicId=${encodeURIComponent(topicId)}`);
  }

  function handleTopicCardActivate(topicId: string) {
    openTopic(topicId);
  }

  function onTopicKeyDown(event: KeyboardEvent<HTMLElement>, topicId: string) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTopicCardActivate(topicId);
    }
  }

  const setTopicElement = useCallback((topicId: string, element: HTMLElement | null) => {
    if (element) {
      if (topicRefs.current.get(topicId) === element) {
        return;
      }
      topicRefs.current.set(topicId, element);
      setLayoutVersion((current) => current + 1);
      return;
    }

    if (!topicRefs.current.has(topicId)) {
      return;
    }
    topicRefs.current.delete(topicId);
    setLayoutVersion((current) => current + 1);
  }, []);

  const getTopicElementRef = useCallback((topicId: string) => {
    const existing = topicRefCallbacks.current.get(topicId);
    if (existing) {
      return existing;
    }

    const callback = (element: HTMLElement | null) => {
      setTopicElement(topicId, element);
      if (element === null) {
        topicRefCallbacks.current.delete(topicId);
      }
    };

    topicRefCallbacks.current.set(topicId, callback);
    return callback;
  }, [setTopicElement]);

  async function handleRoadmapCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submission = prepareRoadmapCreateSubmission(roadmapCreateDraft);
    if (!submission.ok) {
      setRoadmapCreateError(language === "ru" ? "Укажите название roadmap." : "Roadmap title is required.");
      return;
    }

    setRoadmapCreateError(null);
    setIsRoadmapCreating(true);
    try {
      const newRoadmapId = await createRoadmap(submission.payload);
      setActiveRoadmapId(newRoadmapId);
      setRoadmapCreateDraft(initialRoadmapCreateDraft());
      setIsRoadmapCreatePanelOpen(false);
      roadmap.reload();
    } catch (error) {
      setRoadmapCreateError(
        error instanceof Error
          ? error.message
          : language === "ru"
            ? "Не удалось создать roadmap."
            : "Failed to create roadmap."
      );
    } finally {
      setIsRoadmapCreating(false);
    }
  }

  async function handleTopicCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = topicCreateDraft.title.trim();
    if (!title) {
      setTopicMutationError(copy.topicTitleRequired);
      return;
    }

    setTopicMutationError(null);
    setIsTopicCreating(true);
    try {
      if (allTopics.length === 0 && roadmapType === "graph") {
        pendingFirstTopicCenterRef.current = true;
      }
      await createRoadmapTopic(
        activeRoadmapId!,
        buildTopicCreatePayload({
          title,
          description: topicCreateDraft.description.trim(),
          position:
            !topicCreateAnchor && (roadmapType === "levels" || roadmapType === "cycles") && allTopics.length > 0
              ? Math.max(...allTopics.map((topic) => topic.position), 0) + 1
              : undefined,
          anchor: topicCreateAnchor
            ? {
                parentId: topicCreateAnchor.parentId,
                direction: topicCreateAnchor.direction
              }
            : null
        })
      );

      setTopicCreateDraft(() => ({
        title: "",
        description: ""
      }));
      setIsTopicCreateModalOpen(false);
      setTopicCreateAnchor(null);
      topicCreateModalTriggerRef.current = null;
      roadmap.reload();
    } catch (error) {
      setTopicMutationError(error instanceof Error ? error.message : copy.topicCreateFailed);
    } finally {
      setIsTopicCreating(false);
    }
  }

  async function handleStructuredTopicStatusChange(topic: RoadmapTopic, nextStatus: RoadmapTopicStatus) {
    const submission = prepareRoadmapTopicEditSubmission({
      topic,
      draft: {
        title: topic.title,
        description: topic.description,
        status: nextStatus
      }
    });

    if (!submission.ok) {
      if (submission.reason === "title_required") {
        setTopicMutationError(copy.topicTitleRequired);
        return;
      }

      setTopicMutationError(
        getTopicStatusErrorMessage(
          submission.validationResult,
          topic,
          nextStatus,
          copy,
          language
        )
      );
      return;
    }

    setTopicMutationError(null);
    setUpdatingTopicId(topic.id);
    try {
      await updateRoadmapTopic(activeRoadmapId!, topic.id, submission.payload);
      roadmap.reload();
    } catch (error) {
      setTopicMutationError(error instanceof Error ? error.message : copy.topicUpdateFailed);
    } finally {
      setUpdatingTopicId(null);
    }
  }

  function startTopicEditing(topic: RoadmapTopic, triggerElement?: HTMLElement) {
    if (triggerElement) {
      topicModalTriggerRef.current = triggerElement;
    }

    setEditingTopicId(topic.id);
    setTopicEditDraft({
      topicId: topic.id,
      title: topic.title,
      description: topic.description,
      status: topic.status
    });
    setTopicMutationError(null);
  }

  function cancelTopicEditing() {
    setEditingTopicId(null);
    setTopicEditDraft(null);
    const trigger = topicModalTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
    topicModalTriggerRef.current = null;
  }

  async function handleTopicUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTopicId || !topicEditDraft || topicEditDraft.topicId !== editingTopicId) {
      return;
    }

    if (!editingTopic) {
      setTopicMutationError(copy.topicUpdateFailed);
      return;
    }

    const submission = prepareRoadmapTopicEditSubmission({
      topic: editingTopic,
      draft: {
        title: topicEditDraft.title,
        description: topicEditDraft.description,
        status: topicEditDraft.status
      }
    });
    if (!submission.ok) {
      if (submission.reason === "title_required") {
        setTopicMutationError(copy.topicTitleRequired);
        return;
      }

      setTopicMutationError(
        getTopicStatusErrorMessage(
          submission.validationResult,
          editingTopic,
          topicEditDraft.status,
          copy,
          language
        )
      );
      return;
    }

    setTopicMutationError(null);
    setUpdatingTopicId(editingTopicId);
    try {
      await updateRoadmapTopic(activeRoadmapId!, editingTopicId, submission.payload);
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
      await deleteRoadmapTopic(activeRoadmapId!, topic.id);
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

  async function handleDependencyDelete(topicId: string, dependencyTopicId: string) {
    const key = `${topicId}:${dependencyTopicId}`;
    setDependencyMutationError(null);
    setRemovingDependencyKey(key);

    try {
      await deleteRoadmapDependency(activeRoadmapId!, topicId, dependencyTopicId);
      roadmap.reload();
    } catch (error) {
      setDependencyMutationError(
        error instanceof Error ? error.message : copy.dependencyRemoveFailed
      );
    } finally {
      setRemovingDependencyKey(null);
    }
  }

  function handleTopicCreateTitleChange(value: string) {
    setTopicCreateDraft((current) => ({
      ...current,
      title: value
    }));
  }

  function handleTopicCreateDescriptionChange(value: string) {
    setTopicCreateDraft((current) => ({
      ...current,
      description: value
    }));
  }

  function handleRoadmapCreateTitleChange(value: string) {
    setRoadmapCreateDraft((current) => ({
      ...current,
      title: value
    }));
  }

  function handleRoadmapCreateTypeChange(value: RoadmapType) {
    setRoadmapCreateDraft((current) => ({
      ...current,
      type: value
    }));
  }

  function handleGraphPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (window.matchMedia(`(max-width: ${ROADMAP_MOBILE_BREAKPOINT}px)`).matches) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (
      target.closest(
        ".roadmap-topic-card, .roadmap-topic-menu, .roadmap-modal, .roadmap-connection-remove, button, input, textarea, a"
      )
    ) {
      return;
    }

    event.preventDefault();
    setPanPointerId(event.pointerId);
    panStartPointRef.current = {
      x: event.clientX,
      y: event.clientY
    };
    panStartOffsetRef.current = {
      x: sceneTransformRef.current.offsetX,
      y: sceneTransformRef.current.offsetY
    };
  }

  function handleFitAll() {
    const graphElement = graphRef.current;
    if (!graphElement || allTopics.length === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const topic of allTopics) {
      const el = topicRefs.current.get(topic.id);
      if (!el) continue;
      const tr = el.getBoundingClientRect();
      const gr = graphElement.getBoundingClientRect();
      const current = sceneTransformRef.current;
      const left = (tr.left - gr.left - current.offsetX) / current.scale;
      const top = (tr.top - gr.top - current.offsetY) / current.scale;
      const width = tr.width / current.scale;
      const height = tr.height / current.scale;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + width);
      maxY = Math.max(maxY, top + height);
    }

    if (!Number.isFinite(minX)) return;

    const padding = 40;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;
    const scaleX = graphElement.clientWidth / contentWidth;
    const scaleY = graphElement.clientHeight / contentHeight;
    const fitScale = clampGraphScale(
      Math.min(scaleX, scaleY),
      ROADMAP_MIN_SCALE,
      ROADMAP_MAX_SCALE
    );

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    applySceneTransform({
      scale: fitScale,
      offsetX: graphElement.clientWidth / 2 - centerX * fitScale,
      offsetY: graphElement.clientHeight / 2 - centerY * fitScale
    });
  }

  function handleZoomIn() {
    const graphElement = graphRef.current;
    if (!graphElement) {
      return;
    }

    updateSceneScale(sceneTransformRef.current.scale + 0.12, {
      x: graphElement.clientWidth / 2,
      y: graphElement.clientHeight / 2
    });
  }

  function handleZoomOut() {
    const graphElement = graphRef.current;
    if (!graphElement) {
      return;
    }

    updateSceneScale(sceneTransformRef.current.scale - 0.12, {
      x: graphElement.clientWidth / 2,
      y: graphElement.clientHeight / 2
    });
  }

  const dependencyEdgeControls = useMemo(
    () =>
      connections.map((connection) => {
        const fromTitle = topicById.get(connection.fromId)?.title ?? connection.fromId;
        const toTitle = topicById.get(connection.toId)?.title ?? connection.toId;
        return {
          key: `${connection.toId}:${connection.fromId}`,
          topicId: connection.toId,
          dependencyTopicId: connection.fromId,
          x: connection.x2,
          y: connection.y2,
          fromTitle,
          toTitle
        };
      }),
    [connections, topicById]
  );
  const roadmapCreateFormCopy = useMemo(
    () => ({
      title: language === "ru" ? "Создать roadmap" : "Create roadmap",
      description:
        language === "ru"
          ? "Выберите тип roadmap, задайте название и создайте отдельное пространство обучения."
          : "Choose a roadmap type, give it a title, and create a dedicated learning space.",
      roadmapTitleLabel: language === "ru" ? "Название roadmap" : "Roadmap title",
      roadmapTitlePlaceholder:
        language === "ru" ? "Например: Engineering Base" : "For example: Engineering Base",
      typeLabel: language === "ru" ? "Тип roadmap" : "Roadmap type",
      submitLabel: language === "ru" ? "Создать roadmap" : "Create roadmap",
      submitLoadingLabel: language === "ru" ? "Создание..." : "Creating...",
      graphLabel: "Graph",
      graphDescription: getRoadmapTypeDescription("graph", language),
      levelsLabel: "Levels",
      levelsDescription: getRoadmapTypeDescription("levels", language),
      cyclesLabel: "Cycles",
      cyclesDescription: getRoadmapTypeDescription("cycles", language)
    }),
    [language]
  );

  return (
    <section className="roadmap-view">
      <header className="roadmap-header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
          {hasActiveRoadmap ? <RoadmapTypePill type={roadmapType} language={language} /> : null}
          <RoadmapSwitcher className="roadmap-switcher roadmap-switcher-roadmap" />
          {roadmap.state.status === "success" && hasActiveRoadmap ? (
            <div className="roadmap-header-actions">
              {roadmapType === "graph" && stages.length > 0 ? (
                <div className="roadmap-canvas-controls" role="group" aria-label="Roadmap canvas controls">
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={handleZoomOut}
                    disabled={sceneTransform.scale <= ROADMAP_MIN_SCALE}
                    aria-label={copy.zoomOut}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={handleZoomIn}
                    disabled={sceneTransform.scale >= ROADMAP_MAX_SCALE}
                    aria-label={copy.zoomIn}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => recenterGraphScene(1)}
                  >
                    {copy.recenter}
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={handleFitAll}
                  >
                    {copy.fitAll}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className="button button-outline"
                onClick={(event) => openTopicCreateModal(event.currentTarget)}
                disabled={isTopicCreating}
              >
                {roadmapActionLabel}
              </button>
            </div>
          ) : null}
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
        hasActiveRoadmap ? (
          stages.length > 0 ? (
          <>
            {isTopicCreateModalOpen ? (
              <div className="roadmap-modal-overlay" role="presentation">
                <div
                  className="roadmap-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="roadmap-topic-create-modal-title"
                >
                  <div className="roadmap-modal-header">
                    <h4 id="roadmap-topic-create-modal-title">
            {topicCreateAnchor
              ? copy.topicCreateDirectionTitle(topicCreateAnchor.direction)
              : getRoadmapItemCreateTitle(roadmapType, language)}
                    </h4>
                    <button
                      type="button"
                      className="roadmap-modal-close"
                      onClick={closeTopicCreateModal}
                      aria-label={copy.topicCreateCloseAria}
                      disabled={isTopicCreating}
                    >
                      ×
                    </button>
                  </div>

                  <TopicMutationPanel
                    copy={copy}
                    draft={topicCreateDraft}
                    error={topicMutationError}
                    title={
                      topicCreateAnchor && topicCreateAnchorTopic
                        ? copy.topicCreateDirectionTitle(topicCreateAnchor.direction)
                        : getRoadmapItemCreateTitle(roadmapType, language)
                    }
                    subtitle={
                      topicCreateAnchor && topicCreateAnchorTopic
                        ? copy.topicCreateDirectionSubtitle(
                            topicCreateAnchorTopic.title,
                            topicCreateAnchor.direction
                          )
                        : getRoadmapItemCreateSubtitle(roadmapType, language)
                    }
                    submitLabel={
                      topicCreateAnchor
                        ? copy.topicCreateDirectionButton(topicCreateAnchor.direction)
                        : getRoadmapItemSubmitLabel(roadmapType, language)
                    }
                    submitLoadingLabel={
                      topicCreateAnchor
                        ? copy.topicCreatingDirectionButton(topicCreateAnchor.direction)
                        : getRoadmapItemSubmittingLabel(roadmapType, language)
                    }
                    isSubmitting={isTopicCreating}
                    onSubmit={handleTopicCreate}
                    onTitleChange={handleTopicCreateTitleChange}
                    onDescriptionChange={handleTopicCreateDescriptionChange}
                    onCancel={closeTopicCreateModal}
                    titleInputRef={topicCreateModalTitleInputRef}
                  />
                </div>
              </div>
            ) : null}

            {editingTopicId && topicEditDraft && editingTopic ? (
              <div className="roadmap-modal-overlay" role="presentation">
                <div
                  className="roadmap-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="roadmap-topic-modal-title"
                >
                  <div className="roadmap-modal-header">
                    <h4 id="roadmap-topic-modal-title">
                      {copy.topicEditButton}: {editingTopic.title}
                    </h4>
                    <button
                      type="button"
                      className="roadmap-modal-close"
                      onClick={cancelTopicEditing}
                      aria-label={copy.topicEditCloseAria}
                      disabled={updatingTopicId === editingTopic.id || deletingTopicId === editingTopic.id}
                    >
                      ×
                    </button>
                  </div>

                  {topicMutationError ? (
                    <div className="dashboard-error roadmap-modal-error">
                      <p>{topicMutationError}</p>
                    </div>
                  ) : null}

                  <form className="roadmap-stage-edit-form" onSubmit={handleTopicUpdate}>
                    <label className="roadmap-topic-field roadmap-topic-field-title">
                      <span>{copy.topicFieldTitle}</span>
                      <input
                        ref={topicModalTitleInputRef}
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

                    <label className="roadmap-topic-field">
                      <span>{copy.topicFieldStatus}</span>
                      <select
                        className="input"
                        value={topicEditDraft.status}
                        onChange={(event) =>
                          setTopicEditDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  status: event.target.value as RoadmapTopicStatus
                                }
                              : current
                          )
                        }
                        disabled={updatingTopicId === editingTopic.id || deletingTopicId === editingTopic.id}
                      >
                        {getRoadmapTopicStatuses().map((status) => (
                          <option key={status} value={status}>
                            {getStatusLabel(status, language)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="roadmap-stage-edit-actions roadmap-modal-actions">
                      <button
                        type="button"
                        className="button button-outline roadmap-topic-delete-button"
                        disabled={updatingTopicId === editingTopic.id || deletingTopicId === editingTopic.id}
                        onClick={() => {
                          void handleTopicDelete(editingTopic);
                        }}
                      >
                        {deletingTopicId === editingTopic.id
                          ? copy.topicDeletingButton
                          : copy.topicDeleteButton}
                      </button>
                      <button
                        type="submit"
                        className="button button-primary"
                        disabled={updatingTopicId === editingTopic.id || deletingTopicId === editingTopic.id}
                      >
                        {updatingTopicId === editingTopic.id
                          ? copy.topicUpdatingButton
                          : copy.topicSaveButton}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {roadmapType === "levels" ? (
              <>
                <LevelsRoadmapRenderer
                  topics={allTopics}
                  copy={copy}
                  language={language}
                  onEdit={startTopicEditing}
                  onOpenWorkspace={handleTopicCardActivate}
                  onCreateNext={openTopicCreateModal}
                />
                {topicMutationError && !isTopicCreateModalOpen ? (
                  <div className="dashboard-error">
                    <p>{topicMutationError}</p>
                  </div>
                ) : null}
              </>
            ) : roadmapType === "cycles" ? (
              <>
                <CyclesRoadmapRenderer
                  topics={allTopics}
                  copy={copy}
                  language={language}
                  onEdit={startTopicEditing}
                  onOpenWorkspace={handleTopicCardActivate}
                  onCreateNext={openTopicCreateModal}
                  onStatusChange={handleStructuredTopicStatusChange}
                  updatingTopicId={updatingTopicId}
                />
                {topicMutationError && !isTopicCreateModalOpen ? (
                  <div className="dashboard-error">
                    <p>{topicMutationError}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <>
            <div
              className="roadmap-graph"
              ref={graphRef}
              onPointerDown={handleGraphPointerDown}
              data-panning={panPointerId !== null ? "true" : "false"}
            >
            <div
              className="roadmap-graph-canvas"
              ref={graphCanvasRef}
              data-interacting={isGraphInteracting ? "true" : "false"}
              style={{
                width: `${graphSize.width}px`,
                height: `${graphSize.height}px`,
                transform: `translate3d(${sceneTransform.offsetX}px, ${sceneTransform.offsetY}px, 0) scale(${sceneTransform.scale})`
              }}
              >
                <svg
                  className="roadmap-connections"
                  viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                <defs>
                  <marker
                    id="roadmap-arrowhead"
                    markerWidth="16"
                    markerHeight="12"
                    viewBox="0 0 16 12"
                    refX="15"
                    refY="6"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <polygon points="0 0, 16 6, 0 12" fill="#c2d2ef" />
                  </marker>
                </defs>
                {connections.map((connection) => (
                  <path
                    key={`${connection.fromId}-${connection.toId}`}
                    className="roadmap-connection"
                    d={buildConnectionPath(
                      connection.x1,
                      connection.y1,
                      connection.x2,
                      connection.y2
                    )}
                    markerEnd="url(#roadmap-arrowhead)"
                  />
                ))}
                </svg>

                <div
                  className="roadmap-connection-controls"
                  role="group"
                  aria-label={copy.dependencyControlsAria}
                >
                {dependencyEdgeControls.map((control) => {
                  const isRemoving =
                    removingDependencyKey === `${control.topicId}:${control.dependencyTopicId}`;
                  return (
                    <button
                      key={control.key}
                      type="button"
                      className="roadmap-connection-remove"
                      style={{ left: `${control.x}px`, top: `${control.y}px` }}
                      aria-label={copy.dependencyRemoveEdgeAria(control.fromTitle, control.toTitle)}
                      disabled={isRemoving}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleDependencyDelete(control.topicId, control.dependencyTopicId);
                      }}
                    >
                      {isRemoving ? copy.dependencyRemovingButton : "×"}
                    </button>
                  );
                })}
                </div>

                <div
                  className="roadmap-graph-scene"
                  ref={graphSceneRef}
                  aria-label={copy.stageAria}
                >
                <ul
                  className="roadmap-graph-nodes"
                  style={{
                    gridTemplateColumns: `repeat(${maxGridColumns}, minmax(280px, 280px))`
                  }}
                >
                  {allTopics.map((topic) => {
                    const placement = topicGridPlacementById.get(topic.id);

                    return (
                      <li
                        key={topic.id}
                        style={{
                          gridRow: placement?.row ?? 1,
                          gridColumn: placement?.column ?? Math.max(topic.position, 1)
                        }}
                      >
                          <article
                            ref={getTopicElementRef(topic.id)}
                            data-roadmap-topic-id={topic.id}
                            className="roadmap-topic-card"
                            role="link"
                            tabIndex={0}
                            onClick={() => handleTopicCardActivate(topic.id)}
                            onKeyDown={(event) => onTopicKeyDown(event, topic.id)}
                            aria-label={copy.topicOpenAria(topic.title)}
                          >
                            <div className="roadmap-topic-top">
                              <span
                                className={`roadmap-status-badge ${getStatusClassName(topic.status)}`}
                              >
                                {getStatusLabel(topic.status, language)}
                              </span>
                              {topic.status === "completed" && topic.confidence !== null && topic.confidence !== undefined && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    marginLeft: "0.25rem",
                                    backgroundColor:
                                      topic.confidence <= 2 ? "#eab308" :
                                      topic.confidence === 3 ? "#3b82f6" : "#22c55e"
                                  }}
                                  title={`Confidence: ${topic.confidence}/5`}
                                />
                              )}
                              <div className="roadmap-topic-meta">
                                <button
                                  type="button"
                                  className="roadmap-topic-edit-trigger"
                                  aria-label={`${copy.topicEditButton}: ${topic.title}`}
                                  disabled={
                                    isTopicCreating ||
                                    updatingTopicId === topic.id ||
                                    deletingTopicId === topic.id
                                  }
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    startTopicEditing(topic, event.currentTarget);
                                  }}
                                >
                                  <Pencil size={14} />
                                </button>
                                <div className="roadmap-topic-menu">
                                  <button
                                    type="button"
                                    className="roadmap-topic-menu-trigger"
                                    aria-label={copy.topicMenuAria(topic.title)}
                                    aria-haspopup="menu"
                                    aria-expanded={topicMenuTopicId === topic.id}
                                    disabled={isTopicCreating}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setTopicMenuTopicId((current) =>
                                        current === topic.id ? null : topic.id
                                      );
                                    }}
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                  {topicMenuTopicId === topic.id ? (
                                    <div className="roadmap-topic-menu-panel" role="menu">
                                      <button
                                        type="button"
                                        className="roadmap-topic-menu-item"
                                        role="menuitem"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          startDirectionalTopicCreate(topic, "left", event.currentTarget);
                                        }}
                                      >
                                        {copy.topicMenuCreateLeft}
                                      </button>
                                      <button
                                        type="button"
                                        className="roadmap-topic-menu-item"
                                        role="menuitem"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          startDirectionalTopicCreate(topic, "right", event.currentTarget);
                                        }}
                                      >
                                        {copy.topicMenuCreateRight}
                                      </button>
                                      <button
                                        type="button"
                                        className="roadmap-topic-menu-item"
                                        role="menuitem"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          startDirectionalTopicCreate(topic, "below", event.currentTarget);
                                        }}
                                      >
                                        {copy.topicMenuCreateBelow}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="roadmap-topic-core">
                              <div className="roadmap-topic-center">
                                <h4 className="roadmap-topic-title" title={topic.description || undefined}>{topic.title}</h4>

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
                              </div>
                            </div>

                          </article>
                      </li>
                    );
                  })}
                </ul>
                </div>
              </div>
            </div>

            {topicMutationError && !isTopicCreateModalOpen ? (
              <div className="dashboard-error">
                <p>{topicMutationError}</p>
              </div>
            ) : null}

            {dependencyMutationError ? (
              <div className="dashboard-error">
                <p>{dependencyMutationError}</p>
              </div>
            ) : null}

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
              </div>
              <p className="roadmap-next-topic">
                {copy.nextAvailableTopic(nextTopic ? nextTopic.title : copy.noUnlockedTopics)}
              </p>
            </footer>
              </>
            )}
          </>
        ) : (
            <TypedRoadmapEmptyState
              type={roadmapType}
              language={language}
              disabled={isTopicCreating}
              onCreateFirst={openTopicCreateModal}
            />
          )
        ) : (
          isRoadmapCreatePanelOpen ? (
            <RoadmapCreateForm
              copy={roadmapCreateFormCopy}
              draft={roadmapCreateDraft}
              error={roadmapCreateError}
              isSubmitting={isRoadmapCreating}
              onSubmit={handleRoadmapCreate}
              onTitleChange={handleRoadmapCreateTitleChange}
              onTypeChange={handleRoadmapCreateTypeChange}
            />
          ) : (
            <RoadmapCreateEntryState
              language={language}
              createHref="/roadmap?create=1"
              onOpenCreate={() => {
                setRoadmapCreateError(null);
                setRoadmapCreateDraft(initialRoadmapCreateDraft());
                setIsRoadmapCreatePanelOpen(true);
              }}
            />
          )
        )
      ) : null}
    </section>
  );
}
