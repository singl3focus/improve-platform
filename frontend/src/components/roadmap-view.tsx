"use client";

import {
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";
import { Link2, MoreHorizontal, Pencil } from "lucide-react";
import { useRoadmapGraphLayout } from "@/components/roadmap/use-roadmap-graph-layout";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import {
  buildConnectionPath,
  isDragGesture,
  normalizeGraphPoint
} from "@/lib/roadmap-graph";
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

interface QuickCreateDraft {
  topicTitle: string;
  topicDescription: string;
}

interface TopicCreateDraft {
  title: string;
  description: string;
}

interface TopicEditDraft {
  topicId: string;
  title: string;
  description: string;
}

interface ApiErrorDetails {
  message: string;
  code: string | null;
}

interface TopicCreateResult {
  topicId: string;
}

const ROADMAP_COPY = {
  ru: {
    title: "Дорожная карта обучения",
    subtitle:
      "Отслеживайте прогресс по этапам, зависимости между темами и текущие блокировки.",
    loadingTitle: "Загрузка графа roadmap...",
    retry: "Повторить",
    zoomIn: "Увеличить",
    zoomOut: "Уменьшить",
    recenter: "Центр",
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
    topicCreateSubtitle: "Создайте новую тему в текущем roadmap.",
    topicCreateChildTitle: "Добавить дочернюю тему",
    topicCreateChildSubtitle: (parentTitle: string) =>
      `Новая тема будет создана после «${parentTitle}» с автосвязью.`,
    topicFieldTitle: "Название",
    topicFieldDescription: "Описание",
    topicTitlePlaceholder: "Например: Работа с формами",
    topicDescriptionPlaceholder: "Кратко: что изучаем в этой теме",
    topicCreateButton: "Добавить тему",
    topicCreatingButton: "Добавление...",
    topicCreateChildButton: "Создать дочернюю тему",
    topicCreatingChildButton: "Создание дочерней темы...",
    topicEditButton: "Редактировать",
    topicDeleteButton: "Удалить",
    topicMenuAria: (title: string) => `Действия для темы «${title}»`,
    topicMenuCreateChild: "Создать дочернюю",
    topicCreateNoNextStage: "Для создания дочерней темы нужен следующий этап roadmap.",
    topicCreateDependencyFailedAfterCreate:
      "Тема создана, но автосвязь с родительской темой не добавлена. Свяжите темы вручную.",
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
    dependencyDragHandleAria: (title: string) =>
      `Начать перетаскивание зависимости из темы «${title}»`,
    dependencyDragHandleActiveAria: (title: string) =>
      `Источник связи выбран: «${title}». Перетащите к целевой теме.`,
    dependencyControlsAria: "Управление связями графа",
    dependencyRemoveEdgeAria: (fromTitle: string, toTitle: string) =>
      `Удалить связь: «${fromTitle}» -> «${toTitle}»`,
    dependencyRemoveButton: "Удалить связь",
    dependencyRemovingButton: "Удаление...",
    dependencySelfError: "Тема не может зависеть сама от себя.",
    dependencyCycleError: "Эта связь создаёт цикл и не может быть добавлена.",
    dependencyDuplicateError: "Такая зависимость уже существует.",
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
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    recenter: "Recenter",
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
    topicCreateSubtitle: "Create a new topic in your current roadmap.",
    topicCreateChildTitle: "Add child topic",
    topicCreateChildSubtitle: (parentTitle: string) =>
      `The new topic will be created after "${parentTitle}" with auto-linking.`,
    topicFieldTitle: "Title",
    topicFieldDescription: "Description",
    topicTitlePlaceholder: "For example: Working with forms",
    topicDescriptionPlaceholder: "Short note about what to learn in this topic",
    topicCreateButton: "Add topic",
    topicCreatingButton: "Adding...",
    topicCreateChildButton: "Create child topic",
    topicCreatingChildButton: "Creating child topic...",
    topicEditButton: "Edit",
    topicDeleteButton: "Delete",
    topicMenuAria: (title: string) => `Topic actions for "${title}"`,
    topicMenuCreateChild: "Create child",
    topicCreateNoNextStage: "A next roadmap stage is required to create a child topic.",
    topicCreateDependencyFailedAfterCreate:
      "Topic was created, but parent auto-link failed. Link topics manually.",
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
    dependencyDragHandleAria: (title: string) =>
      `Start dragging a dependency from topic "${title}"`,
    dependencyDragHandleActiveAria: (title: string) =>
      `Dependency source selected: "${title}". Drag to a target topic.`,
    dependencyControlsAria: "Roadmap dependency controls",
    dependencyRemoveEdgeAria: (fromTitle: string, toTitle: string) =>
      `Remove dependency link: "${fromTitle}" -> "${toTitle}"`,
    dependencyRemoveButton: "Remove link",
    dependencyRemovingButton: "Removing...",
    dependencySelfError: "A topic cannot depend on itself.",
    dependencyCycleError: "This link creates a cycle and cannot be added.",
    dependencyDuplicateError: "This dependency already exists.",
    dependencyAddFailed: "Dependency creation failed.",
    dependencyRemoveFailed: "Dependency removal failed.",
    defaultRoadmapTitle: "Learning roadmap",
    defaultStageTitle: "Stage 1"
  }
} as const;

type RoadmapCopy = (typeof ROADMAP_COPY)[keyof typeof ROADMAP_COPY];

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
  copy: RoadmapCopy
): string {
  const code = getErrorCode(error);
  if (code === "self_dependency") {
    return copy.dependencySelfError;
  }
  if (code === "cycle_detected") {
    return copy.dependencyCycleError;
  }
  if (
    code === "duplicate_dependency" ||
    code === "dependency_exists" ||
    code === "already_exists"
  ) {
    return copy.dependencyDuplicateError;
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
  title: string;
  description: string;
}): Promise<TopicCreateResult> {
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
  topicId: string,
  payload: {
    title: string;
    description: string;
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

function getConnectionMidpoint(connection: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): { x: number; y: number } {
  const t = 0.5;
  const controlY = connection.y1 + Math.max((connection.y2 - connection.y1) * 0.5, 36);
  const cubic = (p0: number, p1: number, p2: number, p3: number) =>
    (1 - t) ** 3 * p0 +
    3 * (1 - t) ** 2 * t * p1 +
    3 * (1 - t) * t ** 2 * p2 +
    t ** 3 * p3;

  return {
    x: cubic(connection.x1, connection.x1, connection.x2, connection.x2),
    y: cubic(connection.y1, controlY, controlY, connection.y2)
  };
}

function useRoadmapData(errorFallback: string) {
  const [state, setState] = useState<RoadmapState>(initialRoadmapState());
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

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
    reload
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
      <header>
        <h3>{props.title ?? props.copy.topicCreateTitle}</h3>
        <p>{props.subtitle ?? props.copy.topicCreateSubtitle}</p>
      </header>

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

        {props.onCancel ? (
          <div className="roadmap-stage-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={props.isSubmitting}
              onClick={props.onCancel}
            >
              {props.copy.topicCancelButton}
            </button>
            <button type="submit" className="button button-primary" disabled={props.isSubmitting}>
              {props.isSubmitting
                ? (props.submitLoadingLabel ?? props.copy.topicCreatingButton)
                : (props.submitLabel ?? props.copy.topicCreateButton)}
            </button>
          </div>
        ) : (
          <button type="submit" className="button button-primary" disabled={props.isSubmitting}>
            {props.isSubmitting
              ? (props.submitLoadingLabel ?? props.copy.topicCreatingButton)
              : (props.submitLabel ?? props.copy.topicCreateButton)}
          </button>
        )}
      </form>
    </section>
  );
}

function QuickCreatePanel(props: {
  copy: RoadmapCopy;
  draft: QuickCreateDraft;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTopicTitleChange: (value: string) => void;
  onTopicDescriptionChange: (value: string) => void;
}) {
  return (
    <section className="roadmap-quick-create">
      <header>
        <h3>{props.copy.quickCreateTitle}</h3>
        <p>{props.copy.quickCreateSubtitle}</p>
      </header>

      {props.error ? (
        <div className="dashboard-error">
          <p>{props.error}</p>
        </div>
      ) : null}

      <form className="roadmap-quick-create-form" onSubmit={props.onSubmit}>
        <label className="roadmap-quick-create-field">
          <span>{props.copy.quickCreateTopicLabel}</span>
          <input
            type="text"
            className="input"
            value={props.draft.topicTitle}
            onChange={(event) => props.onTopicTitleChange(event.target.value)}
            placeholder={props.copy.quickCreateTopicPlaceholder}
          />
        </label>

        <label className="roadmap-quick-create-field roadmap-quick-create-field-description">
          <span>{props.copy.quickCreateDescriptionLabel}</span>
          <textarea
            value={props.draft.topicDescription}
            onChange={(event) => props.onTopicDescriptionChange(event.target.value)}
            placeholder={props.copy.quickCreateDescriptionPlaceholder}
          />
        </label>

        <button type="submit" className="button button-primary" disabled={props.isSubmitting}>
          {props.isSubmitting ? props.copy.quickCreatingButton : props.copy.quickCreateButton}
        </button>
      </form>
    </section>
  );
}

export function RoadmapView() {
  const router = useRouter();
  const { language } = useUserPreferences();
  const copy = ROADMAP_COPY[language];
  const roadmap = useRoadmapData(copy.errorFallback);
  const roadmapReload = roadmap.reload;
  const graphRef = useRef<HTMLDivElement | null>(null);
  const topicRefs = useRef<Map<string, HTMLElement>>(new Map());
  const suppressTopicClickRef = useRef(false);
  const dependencyDragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const dependencyDragExceededThresholdRef = useRef(false);
  const topicCreateModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const topicModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const topicCreateModalTriggerRef = useRef<HTMLElement | null>(null);
  const topicModalTriggerRef = useRef<HTMLElement | null>(null);
  const { connections, graphSize } = useRoadmapGraphLayout({
    status: roadmap.state.status,
    data: roadmap.state.data,
    graphRef,
    topicRefs
  });
  const [quickCreateDraft, setQuickCreateDraft] = useState<QuickCreateDraft>(initialQuickCreateDraft());
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const [topicCreateDraft, setTopicCreateDraft] = useState<TopicCreateDraft>(initialTopicCreateDraft());
  const [topicEditDraft, setTopicEditDraft] = useState<TopicEditDraft | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicMutationError, setTopicMutationError] = useState<string | null>(null);
  const [isTopicCreating, setIsTopicCreating] = useState(false);
  const [isTopicCreateModalOpen, setIsTopicCreateModalOpen] = useState(false);
  const [updatingTopicId, setUpdatingTopicId] = useState<string | null>(null);
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  const [topicMenuTopicId, setTopicMenuTopicId] = useState<string | null>(null);
  const [childTopicParentId, setChildTopicParentId] = useState<string | null>(null);
  const [dependencyMutationError, setDependencyMutationError] = useState<string | null>(null);
  const [isDependencyMutating, setIsDependencyMutating] = useState(false);
  const [removingDependencyKey, setRemovingDependencyKey] = useState<string | null>(null);
  const [dependencySourceTopicId, setDependencySourceTopicId] = useState<string | null>(null);
  const [dependencyHoverTopicId, setDependencyHoverTopicId] = useState<string | null>(null);
  const [dependencyPreviewPoint, setDependencyPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [activeDependencyDragPointerId, setActiveDependencyDragPointerId] = useState<number | null>(
    null
  );

  const stages = useMemo(() => roadmap.state.data?.stages ?? [], [roadmap.state.data]);

  const stagePositionById = useMemo(() => {
    const map = new Map<string, number>();
    for (const [index, stage] of stages.entries()) {
      map.set(stage.id, index + 1);
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

  const allTopics = useMemo(
    () =>
      stages.flatMap((stage) =>
        [...stage.topics].sort((leftTopic, rightTopic) => leftTopic.position - rightTopic.position)
      ),
    [stages]
  );
  const maxTopicsPerStage = useMemo(
    () =>
      Math.max(
        stages.reduce((maxValue, stage) => Math.max(maxValue, stage.topics.length), 0),
        1
      ),
    [stages]
  );
  const childTopicParent = useMemo(
    () => (childTopicParentId ? topicById.get(childTopicParentId) ?? null : null),
    [childTopicParentId, topicById]
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
    if (!isTopicCreateModalOpen) {
      return;
    }

    topicCreateModalTitleInputRef.current?.focus();
  }, [isTopicCreateModalOpen]);

  function openTopicCreateModal(triggerElement: HTMLElement) {
    topicCreateModalTriggerRef.current = triggerElement;
    setChildTopicParentId(null);
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
    setChildTopicParentId(null);
    const trigger = topicCreateModalTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
    topicCreateModalTriggerRef.current = null;
  }

  function startChildTopicCreate(parentTopic: RoadmapTopic, triggerElement: HTMLElement) {
    topicCreateModalTriggerRef.current = triggerElement;
    setTopicCreateDraft({
      title: "",
      description: ""
    });
    setTopicMutationError(null);
    setTopicMenuTopicId(null);
    setChildTopicParentId(parentTopic.id);
    setIsTopicCreateModalOpen(true);
  }

  function openTopic(topicId: string) {
    router.push(`/topics?topicId=${encodeURIComponent(topicId)}`);
  }

  function handleTopicCardActivate(topicId: string) {
    if (suppressTopicClickRef.current) {
      suppressTopicClickRef.current = false;
      return;
    }

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

    const title = topicCreateDraft.title.trim();
    if (!title) {
      setTopicMutationError(copy.topicTitleRequired);
      return;
    }

    setTopicMutationError(null);
    setIsTopicCreating(true);
    try {
      const createdTopic = await createRoadmapTopic({
        title,
        description: topicCreateDraft.description.trim()
      });

      if (childTopicParentId) {
        try {
          await createRoadmapDependency({
            topicId: createdTopic.topicId,
            prerequisiteTopicId: childTopicParentId
          });
        } catch (error) {
          const dependencyErrorMessage = getDependencyErrorMessage(error, copy);
          setTopicMutationError(
            `${copy.topicCreateDependencyFailedAfterCreate} ${dependencyErrorMessage}`
          );
          setDependencySourceTopicId(childTopicParentId);
          setIsTopicCreateModalOpen(false);
          setChildTopicParentId(null);
          topicCreateModalTriggerRef.current = null;
          roadmap.reload();
          return;
        }
      }

      setTopicCreateDraft(() => ({
        title: "",
        description: ""
      }));
      setIsTopicCreateModalOpen(false);
      setChildTopicParentId(null);
      topicCreateModalTriggerRef.current = null;
      roadmap.reload();
    } catch (error) {
      setTopicMutationError(error instanceof Error ? error.message : copy.topicCreateFailed);
    } finally {
      setIsTopicCreating(false);
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
      description: topic.description
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

    const title = topicEditDraft.title.trim();
    if (!title) {
      setTopicMutationError(copy.topicTitleRequired);
      return;
    }

    setTopicMutationError(null);
    setUpdatingTopicId(editingTopicId);
    try {
      await updateRoadmapTopic(editingTopicId, {
        title,
        description: topicEditDraft.description.trim()
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

  const clearDependencyDragState = useCallback(() => {
    setDependencyHoverTopicId(null);
    setDependencyPreviewPoint(null);
    setActiveDependencyDragPointerId(null);
    dependencyDragStartPointRef.current = null;
    dependencyDragExceededThresholdRef.current = false;
  }, []);

  const clearDependencySourceState = useCallback(() => {
    setDependencySourceTopicId(null);
    clearDependencyDragState();
  }, [clearDependencyDragState]);

  function getTopicAnchorPoint(topicId: string, side: "left" | "right") {
    const graphElement = graphRef.current;
    const topicElement = topicRefs.current.get(topicId);
    if (!graphElement || !topicElement) {
      return null;
    }

    const graphRect = graphElement.getBoundingClientRect();
    const topicRect = topicElement.getBoundingClientRect();

    return {
      x: side === "right" ? topicRect.right - graphRect.left : topicRect.left - graphRect.left,
      y: topicRect.top + topicRect.height / 2 - graphRect.top
    };
  }

  function resolveTopicIdByClientPoint(clientX: number, clientY: number): string | null {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element) {
      return null;
    }

    const topicElement = element.closest("[data-roadmap-topic-id]");
    if (!(topicElement instanceof HTMLElement)) {
      return null;
    }

    const topicId = topicElement.dataset.roadmapTopicId;
    return typeof topicId === "string" && topicId.length > 0 ? topicId : null;
  }

  function getPreviewPointByClientPoint(clientX: number, clientY: number) {
    const graphElement = graphRef.current;
    if (!graphElement) {
      return null;
    }

    return normalizeGraphPoint(clientX, clientY, graphElement.getBoundingClientRect());
  }

  const createDependencyFromSourceToTarget = useCallback(async (
    sourceTopicId: string,
    targetTopicId: string
  ) => {
    if (sourceTopicId === targetTopicId) {
      setDependencyMutationError(copy.dependencySelfError);
      return;
    }

    setDependencyMutationError(null);
    setIsDependencyMutating(true);
    try {
      await createRoadmapDependency({
        topicId: targetTopicId,
        prerequisiteTopicId: sourceTopicId
      });
      clearDependencySourceState();
      roadmapReload();
    } catch (error) {
      setDependencyMutationError(getDependencyErrorMessage(error, copy));
    } finally {
      setIsDependencyMutating(false);
    }
  }, [clearDependencySourceState, copy, roadmapReload]);

  function beginDependencyLinkDrag(topicId: string, clientX: number, clientY: number, pointerId: number) {
    if (isDependencyMutating) {
      return;
    }

    setDependencyMutationError(null);
    setDependencySourceTopicId(topicId);
    setDependencyHoverTopicId(null);
    setDependencyPreviewPoint(getPreviewPointByClientPoint(clientX, clientY));
    setActiveDependencyDragPointerId(pointerId);
    dependencyDragStartPointRef.current = normalizeGraphPoint(
      clientX,
      clientY,
      graphRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    );
    dependencyDragExceededThresholdRef.current = false;
  }

  useEffect(() => {
    if (!dependencySourceTopicId || activeDependencyDragPointerId === null) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeDependencyDragPointerId) {
        return;
      }

      const startPoint = dependencyDragStartPointRef.current;
      if (startPoint) {
        const nextPoint = getPreviewPointByClientPoint(event.clientX, event.clientY);
        if (nextPoint && isDragGesture(startPoint, nextPoint)) {
          dependencyDragExceededThresholdRef.current = true;
        }
      }

      setDependencyPreviewPoint(getPreviewPointByClientPoint(event.clientX, event.clientY));
      const hoverTopicId = resolveTopicIdByClientPoint(event.clientX, event.clientY);
      setDependencyHoverTopicId(hoverTopicId);
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== activeDependencyDragPointerId) {
        return;
      }

      if (!dependencyDragExceededThresholdRef.current) {
        clearDependencySourceState();
        return;
      }

      const targetTopicId = resolveTopicIdByClientPoint(event.clientX, event.clientY);
      clearDependencyDragState();

      if (!targetTopicId || !dependencySourceTopicId) {
        clearDependencySourceState();
        return;
      }

      suppressTopicClickRef.current = true;

      void createDependencyFromSourceToTarget(dependencySourceTopicId, targetTopicId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [
    activeDependencyDragPointerId,
    clearDependencyDragState,
    clearDependencySourceState,
    dependencySourceTopicId,
    createDependencyFromSourceToTarget
  ]);

  useEffect(() => {
    if (!dependencySourceTopicId) {
      return;
    }

    if (roadmap.state.status !== "success") {
      return;
    }

    if (topicById.has(dependencySourceTopicId)) {
      return;
    }

    clearDependencySourceState();
  }, [dependencySourceTopicId, topicById, clearDependencySourceState, roadmap.state.status]);

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

  function handleQuickCreateTopicTitleChange(value: string) {
    setQuickCreateDraft((current) => ({
      ...current,
      topicTitle: value
    }));
  }

  function handleQuickCreateTopicDescriptionChange(value: string) {
    setQuickCreateDraft((current) => ({
      ...current,
      topicDescription: value
    }));
  }

  const dependencyPreviewStart = dependencySourceTopicId
    ? getTopicAnchorPoint(dependencySourceTopicId, "right")
    : null;
  const dependencyPreviewEnd = dependencyHoverTopicId
    ? getTopicAnchorPoint(dependencyHoverTopicId, "left")
    : dependencyPreviewPoint;
  const dependencyEdgeControls = useMemo(
    () =>
      connections.map((connection) => {
        const midpoint = getConnectionMidpoint(connection);
        const fromTitle = topicById.get(connection.fromId)?.title ?? connection.fromId;
        const toTitle = topicById.get(connection.toId)?.title ?? connection.toId;
        return {
          key: `${connection.toId}:${connection.fromId}`,
          topicId: connection.toId,
          dependencyTopicId: connection.fromId,
          x: midpoint.x,
          y: midpoint.y,
          fromTitle,
          toTitle
        };
      }),
    [connections, topicById]
  );

  return (
    <section className="roadmap-view">
      <header className="roadmap-header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
          {roadmap.state.status === "success" && stages.length > 0 ? (
            <div className="roadmap-header-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={(event) => openTopicCreateModal(event.currentTarget)}
                disabled={isTopicCreating || isDependencyMutating}
              >
                {copy.topicCreateButton}
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
                      {childTopicParent ? copy.topicCreateChildTitle : copy.topicCreateTitle}
                    </h4>
                    <button
                      type="button"
                      className="roadmap-modal-close"
                      onClick={closeTopicCreateModal}
                      aria-label={copy.topicCancelButton}
                      disabled={isTopicCreating}
                    >
                      ×
                    </button>
                  </div>

                  <TopicMutationPanel
                    copy={copy}
                    draft={topicCreateDraft}
                    error={topicMutationError}
                    title={childTopicParent ? copy.topicCreateChildTitle : copy.topicCreateTitle}
                    subtitle={
                      childTopicParent
                        ? copy.topicCreateChildSubtitle(childTopicParent.title)
                        : copy.topicCreateSubtitle
                    }
                    submitLabel={
                      childTopicParent ? copy.topicCreateChildButton : copy.topicCreateButton
                    }
                    submitLoadingLabel={
                      childTopicParent
                        ? copy.topicCreatingChildButton
                        : copy.topicCreatingButton
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
                      aria-label={copy.topicCancelButton}
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
                        type="button"
                        className="button button-outline"
                        disabled={updatingTopicId === editingTopic.id || deletingTopicId === editingTopic.id}
                        onClick={cancelTopicEditing}
                      >
                        {copy.topicCancelButton}
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

            <div
              className="roadmap-graph"
              ref={graphRef}
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
                    d={buildConnectionPath(
                      connection.x1,
                      connection.y1,
                      connection.x2,
                      connection.y2
                    )}
                    markerEnd="url(#roadmap-arrowhead)"
                  />
                ))}
                {dependencyPreviewStart && dependencyPreviewEnd ? (
                  <path
                    className="roadmap-connection roadmap-connection-preview"
                    d={buildConnectionPath(
                      dependencyPreviewStart.x,
                      dependencyPreviewStart.y,
                      dependencyPreviewEnd.x,
                      dependencyPreviewEnd.y
                    )}
                    markerEnd="url(#roadmap-arrowhead)"
                  />
                ) : null}
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
                      disabled={isRemoving || isDependencyMutating}
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
                aria-label={copy.stageAria}
              >
                <ul
                  className="roadmap-graph-nodes"
                  style={{
                    gridTemplateColumns: `repeat(${maxTopicsPerStage}, minmax(280px, 280px))`
                  }}
                >
                  {allTopics.map((topic) => {
                    const topicStageId = topic.stageId ?? stages[0]?.id ?? "";
                    const stagePosition = stagePositionById.get(topicStageId) ?? 1;

                    return (
                      <li
                        key={topic.id}
                        style={{
                          gridRow: stagePosition,
                          gridColumn: Math.max(topic.position, 1)
                        }}
                      >
                          <article
                            ref={(element) => setTopicElement(topic.id, element)}
                            data-roadmap-topic-id={topic.id}
                            className={[
                              "roadmap-topic-card",
                              topic.isBlocked ? "roadmap-topic-card-blocked" : "",
                              dependencySourceTopicId === topic.id ? "roadmap-topic-card-link-source" : "",
                              dependencyHoverTopicId === topic.id ? "roadmap-topic-card-link-target" : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            role="link"
                            tabIndex={0}
                            onClick={() => handleTopicCardActivate(topic.id)}
                            onKeyDown={(event) => onTopicKeyDown(event, topic.id)}
                            aria-label={copy.topicOpenAria(topic.title)}
                          >
                            <button
                              type="button"
                              className={[
                                "roadmap-topic-link-handle",
                                dependencySourceTopicId === topic.id
                                  ? "roadmap-topic-link-handle-active"
                                  : ""
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              disabled={isDependencyMutating || isTopicCreating}
                              aria-label={
                                dependencySourceTopicId === topic.id
                                  ? copy.dependencyDragHandleActiveAria(topic.title)
                                  : copy.dependencyDragHandleAria(topic.title)
                              }
                              onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                beginDependencyLinkDrag(
                                  topic.id,
                                  event.clientX,
                                  event.clientY,
                                  event.pointerId
                                );
                              }}
                              onKeyDown={stopTopicCardEvent}
                            >
                              <Link2 size={14} aria-hidden="true" />
                            </button>

                            <div className="roadmap-topic-top">
                              <span
                                className={`roadmap-status-badge ${getStatusClassName(topic.status)}`}
                              >
                                {getStatusLabel(topic.status, language)}
                              </span>
                              <div className="roadmap-topic-meta">
                                <button
                                  type="button"
                                  className="roadmap-topic-edit-trigger"
                                  aria-label={`${copy.topicEditButton}: ${topic.title}`}
                                  disabled={
                                    isTopicCreating ||
                                    updatingTopicId === topic.id ||
                                    deletingTopicId === topic.id ||
                                    isDependencyMutating
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
                                    disabled={isTopicCreating || isDependencyMutating}
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
                                          startChildTopicCreate(topic, event.currentTarget);
                                        }}
                                      >
                                        {copy.topicMenuCreateChild}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                                {topic.isBlocked ? (
                                  <span className="roadmap-blocked-badge">{copy.blocked}</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="roadmap-topic-core">
                              <div className="roadmap-topic-center">
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
                              </div>
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
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                          </article>
                      </li>
                    );
                  })}
                </ul>
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
            <QuickCreatePanel
              copy={copy}
              draft={quickCreateDraft}
              error={quickCreateError}
              isSubmitting={isQuickCreating}
              onSubmit={handleQuickCreate}
              onTopicTitleChange={handleQuickCreateTopicTitleChange}
              onTopicDescriptionChange={handleQuickCreateTopicDescriptionChange}
            />
          </div>
        )
      ) : null}
    </section>
  );
}
