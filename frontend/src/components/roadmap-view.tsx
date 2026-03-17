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
  normalizeGraphPoint,
  parsePositiveInteger
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
    topicCreateSubtitle: "Создайте новую тему в выбранном этапе текущего roadmap.",
    topicCreateChildTitle: "Добавить дочернюю тему",
    topicCreateChildSubtitle: (parentTitle: string, stageTitle: string) =>
      `Новая тема будет создана после «${parentTitle}» в этапе «${stageTitle}» с автосвязью.`,
    topicFieldStage: "Этап",
    topicFieldTitle: "Название",
    topicFieldDescription: "Описание",
    topicFieldPosition: "Позиция",
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
    topicCreateSubtitle: "Create a new topic in the selected stage of your current roadmap.",
    topicCreateChildTitle: "Add child topic",
    topicCreateChildSubtitle: (parentTitle: string, stageTitle: string) =>
      `The new topic will be created after "${parentTitle}" in stage "${stageTitle}" with auto-linking.`,
    topicFieldStage: "Stage",
    topicFieldTitle: "Title",
    topicFieldDescription: "Description",
    topicFieldPosition: "Position",
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
  stageId: string;
  title: string;
  description: string;
  position: number;
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

function StageMutationPanel(props: {
  copy: RoadmapCopy;
  draft: StageCreateDraft;
  error?: string | null;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onCancel?: () => void;
  titleInputRef?: { current: HTMLInputElement | null };
}) {
  return (
    <section className="panel roadmap-stage-mutation-panel">
      <header>
        <h3>{props.copy.stageManageTitle}</h3>
        <p>{props.copy.stageManageSubtitle}</p>
      </header>

      {props.error ? (
        <div className="dashboard-error roadmap-modal-error">
          <p>{props.error}</p>
        </div>
      ) : null}

      <form className="roadmap-stage-form" onSubmit={props.onSubmit}>
        <label className="roadmap-topic-field roadmap-topic-field-title">
          <span>{props.copy.stageFieldTitle}</span>
          <input
            ref={props.titleInputRef}
            type="text"
            className="input"
            value={props.draft.title}
            onChange={(event) => props.onTitleChange(event.target.value)}
            placeholder={props.copy.stageTitlePlaceholder}
          />
        </label>

        <label className="roadmap-topic-field roadmap-topic-field-position">
          <span>{props.copy.stageFieldPosition}</span>
          <input
            type="number"
            min={1}
            className="input"
            value={props.draft.position}
            onChange={(event) => props.onPositionChange(event.target.value)}
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
              {props.copy.stageCancelButton}
            </button>
            <button type="submit" className="button button-primary" disabled={props.isSubmitting}>
              {props.isSubmitting ? props.copy.stageCreatingButton : props.copy.stageCreateButton}
            </button>
          </div>
        ) : (
          <button type="submit" className="button button-primary" disabled={props.isSubmitting}>
            {props.isSubmitting ? props.copy.stageCreatingButton : props.copy.stageCreateButton}
          </button>
        )}
      </form>
    </section>
  );
}

function TopicMutationPanel(props: {
  copy: RoadmapCopy;
  stages: RoadmapResponse["stages"];
  draft: TopicCreateDraft;
  error?: string | null;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  submitLoadingLabel?: string;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStageChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onPositionChange: (value: string) => void;
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
        <label className="roadmap-topic-field">
          <span>{props.copy.topicFieldStage}</span>
          <select
            className="input"
            value={props.draft.stageId}
            onChange={(event) => props.onStageChange(event.target.value)}
          >
            {props.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.title}
              </option>
            ))}
          </select>
        </label>

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

        <label className="roadmap-topic-field roadmap-topic-field-position">
          <span>{props.copy.topicFieldPosition}</span>
          <input
            type="number"
            min={1}
            className="input"
            value={props.draft.position}
            onChange={(event) => props.onPositionChange(event.target.value)}
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
  const stageModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const stageModalTriggerRef = useRef<HTMLElement | null>(null);
  const stageCreateModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const topicCreateModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const topicModalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const stageCreateModalTriggerRef = useRef<HTMLElement | null>(null);
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
  const [stageCreateDraft, setStageCreateDraft] = useState<StageCreateDraft>(
    initialStageCreateDraft()
  );
  const [stageEditDraft, setStageEditDraft] = useState<StageEditDraft | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageMutationError, setStageMutationError] = useState<string | null>(null);
  const [stageMutationSuccess, setStageMutationSuccess] = useState<string | null>(null);
  const [isStageCreating, setIsStageCreating] = useState(false);
  const [isStageCreateModalOpen, setIsStageCreateModalOpen] = useState(false);
  const [updatingStageId, setUpdatingStageId] = useState<string | null>(null);
  const [deletingStageId, setDeletingStageId] = useState<string | null>(null);
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
  const stageById = useMemo(() => {
    const map = new Map<string, (typeof stages)[number]>();
    for (const stage of stages) {
      map.set(stage.id, stage);
    }
    return map;
  }, [stages]);

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
  const editingStage = useMemo(() => {
    if (!editingStageId) {
      return null;
    }

    return stageById.get(editingStageId) ?? null;
  }, [editingStageId, stageById]);

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
  const childTopicTargetStage = useMemo(() => {
    if (!childTopicParent) {
      return null;
    }

    const parentStageIndex = stages.findIndex((stage) => stage.id === childTopicParent.stageId);
    if (parentStageIndex < 0 || parentStageIndex + 1 >= stages.length) {
      return null;
    }

    return stages[parentStageIndex + 1];
  }, [childTopicParent, stages]);

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
    if (!editingStageId) {
      return;
    }

    stageModalTitleInputRef.current?.focus();
  }, [editingStageId]);

  useEffect(() => {
    if (!editingTopicId) {
      return;
    }

    topicModalTitleInputRef.current?.focus();
  }, [editingTopicId]);

  useEffect(() => {
    if (!editingStageId && !editingTopicId && !isStageCreateModalOpen && !isTopicCreateModalOpen) {
      return;
    }

    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (editingStageId) {
        setEditingStageId(null);
        setStageEditDraft(null);
        const trigger = stageModalTriggerRef.current;
        if (trigger && trigger.isConnected) {
          trigger.focus();
        }
        stageModalTriggerRef.current = null;
        return;
      }

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
        return;
      }

      if (isStageCreateModalOpen && !isStageCreating) {
        setIsStageCreateModalOpen(false);
        const trigger = stageCreateModalTriggerRef.current;
        if (trigger && trigger.isConnected) {
          trigger.focus();
        }
        stageCreateModalTriggerRef.current = null;
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    editingStageId,
    editingTopicId,
    isStageCreateModalOpen,
    isStageCreating,
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
    if (!isStageCreateModalOpen) {
      return;
    }

    stageCreateModalTitleInputRef.current?.focus();
  }, [isStageCreateModalOpen]);

  useEffect(() => {
    if (!isTopicCreateModalOpen) {
      return;
    }

    topicCreateModalTitleInputRef.current?.focus();
  }, [isTopicCreateModalOpen]);

  function openStageCreateModal(triggerElement: HTMLElement) {
    stageCreateModalTriggerRef.current = triggerElement;
    setStageMutationError(null);
    setStageMutationSuccess(null);
    setIsStageCreateModalOpen(true);
  }

  function closeStageCreateModal() {
    if (isStageCreating) {
      return;
    }

    setIsStageCreateModalOpen(false);
    setStageMutationError(null);
    const trigger = stageCreateModalTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
    stageCreateModalTriggerRef.current = null;
  }

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
    const parentStageIndex = stages.findIndex((stage) => stage.id === parentTopic.stageId);
    const nextStage = parentStageIndex >= 0 ? stages[parentStageIndex + 1] : null;

    if (!nextStage) {
      setTopicMenuTopicId(null);
      setTopicMutationError(copy.topicCreateNoNextStage);
      return;
    }

    topicCreateModalTriggerRef.current = triggerElement;
    setTopicCreateDraft({
      stageId: nextStage.id,
      title: "",
      description: "",
      position: String((nextStage.topics.length ?? 0) + 1)
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
      const createdTopic = await createRoadmapTopic({
        stageId,
        title,
        description: topicCreateDraft.description.trim(),
        position
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

      setTopicCreateDraft((current) => ({
        stageId,
        title: "",
        description: "",
        position: String(parsePositiveInteger(current.position, fallbackPosition) + 1)
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
      setIsStageCreateModalOpen(false);
      stageCreateModalTriggerRef.current = null;
      roadmap.reload();
    } catch (error) {
      setStageMutationError(error instanceof Error ? error.message : copy.stageCreateFailed);
    } finally {
      setIsStageCreating(false);
    }
  }

  function startStageEditing(
    stage: (typeof stages)[number],
    fallbackPosition: number,
    triggerElement?: HTMLElement
  ) {
    if (triggerElement) {
      stageModalTriggerRef.current = triggerElement;
    }

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
    const trigger = stageModalTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus();
    }
    stageModalTriggerRef.current = null;
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

  function startTopicEditing(topic: RoadmapTopic, triggerElement?: HTMLElement) {
    if (triggerElement) {
      topicModalTriggerRef.current = triggerElement;
    }

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

  function handleStageDraftTitleChange(value: string) {
    setStageCreateDraft((current) => ({
      ...current,
      title: value
    }));
  }

  function handleStageDraftPositionChange(value: string) {
    setStageCreateDraft((current) => ({
      ...current,
      position: value
    }));
  }

  function handleTopicCreateStageChange(stageId: string) {
    const selectedStage = stageById.get(stageId);
    setTopicCreateDraft((current) => ({
      ...current,
      stageId,
      position: String((selectedStage?.topics.length ?? 0) + 1)
    }));
  }

  function handleTopicCreateTitleChange(value: string) {
    setTopicCreateDraft((current) => ({
      ...current,
      title: value
    }));
  }

  function handleTopicCreatePositionChange(value: string) {
    setTopicCreateDraft((current) => ({
      ...current,
      position: value
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
                className="button button-primary"
                onClick={(event) => openStageCreateModal(event.currentTarget)}
                disabled={isStageCreating || isTopicCreating || isDependencyMutating}
              >
                {copy.stageCreateButton}
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={(event) => openTopicCreateModal(event.currentTarget)}
                disabled={isTopicCreating || isStageCreating || isDependencyMutating}
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
            {isStageCreateModalOpen ? (
              <div className="roadmap-modal-overlay" role="presentation">
                <div
                  className="roadmap-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="roadmap-stage-create-modal-title"
                >
                  <div className="roadmap-modal-header">
                    <h4 id="roadmap-stage-create-modal-title">{copy.stageManageTitle}</h4>
                    <button
                      type="button"
                      className="roadmap-modal-close"
                      onClick={closeStageCreateModal}
                      aria-label={copy.stageCancelButton}
                      disabled={isStageCreating}
                    >
                      ×
                    </button>
                  </div>

                  <StageMutationPanel
                    copy={copy}
                    draft={stageCreateDraft}
                    error={stageMutationError}
                    isSubmitting={isStageCreating}
                    onSubmit={handleStageCreate}
                    onTitleChange={handleStageDraftTitleChange}
                    onPositionChange={handleStageDraftPositionChange}
                    onCancel={closeStageCreateModal}
                    titleInputRef={stageCreateModalTitleInputRef}
                  />
                </div>
              </div>
            ) : null}

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
                    stages={stages}
                    draft={topicCreateDraft}
                    error={topicMutationError}
                    title={childTopicParent ? copy.topicCreateChildTitle : copy.topicCreateTitle}
                    subtitle={
                      childTopicParent && childTopicTargetStage
                        ? copy.topicCreateChildSubtitle(
                            childTopicParent.title,
                            childTopicTargetStage.title
                          )
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
                    onStageChange={handleTopicCreateStageChange}
                    onTitleChange={handleTopicCreateTitleChange}
                    onPositionChange={handleTopicCreatePositionChange}
                    onDescriptionChange={handleTopicCreateDescriptionChange}
                    onCancel={closeTopicCreateModal}
                    titleInputRef={topicCreateModalTitleInputRef}
                  />
                </div>
              </div>
            ) : null}

            {editingStageId && stageEditDraft && editingStage ? (
              <div className="roadmap-modal-overlay" role="presentation">
                <div
                  className="roadmap-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="roadmap-stage-modal-title"
                >
                  <div className="roadmap-modal-header">
                    <h4 id="roadmap-stage-modal-title">
                      {copy.stageEditButton}: {editingStage.title}
                    </h4>
                    <button
                      type="button"
                      className="roadmap-modal-close"
                      onClick={cancelStageEditing}
                      aria-label={copy.stageCancelButton}
                    >
                      ×
                    </button>
                  </div>

                  {stageMutationError ? (
                    <div className="dashboard-error roadmap-modal-error">
                      <p>{stageMutationError}</p>
                    </div>
                  ) : null}

                  <form className="roadmap-stage-edit-form" onSubmit={handleStageUpdate}>
                    <label className="roadmap-topic-field roadmap-topic-field-title">
                      <span>{copy.stageFieldTitle}</span>
                      <input
                        ref={stageModalTitleInputRef}
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

                    <div className="roadmap-stage-edit-actions roadmap-modal-actions">
                      <button
                        type="button"
                        className="button button-outline roadmap-stage-delete-button"
                        disabled={updatingStageId === editingStage.id || deletingStageId === editingStage.id}
                        onClick={() => {
                          void handleStageDelete(editingStage);
                        }}
                      >
                        {deletingStageId === editingStage.id
                          ? copy.stageDeletingButton
                          : copy.stageDeleteButton}
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={updatingStageId === editingStage.id || deletingStageId === editingStage.id}
                        onClick={cancelStageEditing}
                      >
                        {copy.stageCancelButton}
                      </button>
                      <button
                        type="submit"
                        className="button button-primary"
                        disabled={updatingStageId === editingStage.id || deletingStageId === editingStage.id}
                      >
                        {updatingStageId === editingStage.id
                          ? copy.stageUpdatingButton
                          : copy.stageSaveButton}
                      </button>
                    </div>
                  </form>
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
                    const stage = stageById.get(topic.stageId) ?? null;
                    const stageTitle = stage?.title ?? copy.defaultStageTitle;
                    const stagePosition = stagePositionById.get(topic.stageId) ?? 1;

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
                              <span className="roadmap-topic-stage-tag">{stageTitle}</span>

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

            {stageMutationError && !editingStageId && !isStageCreateModalOpen ? (
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
