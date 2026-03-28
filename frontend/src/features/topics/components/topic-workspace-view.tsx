"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import {
  type TopicMaterialDraft,
  type TopicTaskDraft,
  useTopicWorkspaceViewModel
} from "@features/topics/hooks/use-topic-workspace-view-model";
import type { AppLanguage } from "@shared/i18n/ui-copy";
import type { MaterialType, MaterialUnit } from "@features/materials/types";
import { resolveUnitByType } from "@features/materials/lib/materials-form";
import type {
  TopicChecklistStatus,
  TopicWorkspace,
  TopicWorkspaceStatus
} from "@features/topics/types";

const MATERIAL_TYPE_OPTIONS: MaterialType[] = ["book", "article", "course", "video"];

const TOPIC_COPY = {
  ru: {
    loading: "Загрузка рабочего пространства темы...",
    loadError: "Не удалось загрузить рабочее пространство темы.",
    retry: "Повторить",
    emptyTitle: "Тема не выбрана",
    emptyDescription:
      "Откройте roadmap и выберите тему, чтобы увидеть рабочее пространство, чеклист и материалы.",
    openRoadmap: "Открыть roadmap",
    notSet: "Не задано",
    topicProgress: "Прогресс темы",
    startDate: "Дата начала",
    targetDate: "Целевая дата",
    completedAt: "Завершено",
    dependenciesTitle: "Зависимости",
    dependenciesSummary: (completed: number, pending: number) =>
      `Выполнено: ${completed} · Ожидают: ${pending}`,
    noDependencies: "Для этой темы нет зависимостей.",
    addDependency: "Добавить зависимость",
    removeDependency: "Убрать",
    selectTopic: "Выберите тему...",
    dependencyRequired: "Обязательная зависимость",
    dependencyOptional: "Необязательная зависимость",
    dependencyReady: "Готово",
    dependencyPending: "Ожидает",
    checklistTitle: "Чеклист / Задачи",
    checklistSubtitle: "Отслеживайте выполнение задач по теме.",
    checklistEmpty: "Для этой темы чеклист пуст.",
    statusLabel: "Статус",
    materialsTitle: "Материалы",
    materialsSubtitle: "Ресурсы для изучения, упорядоченные по позиции.",
    materialsEmpty: "Пока нет материалов по этой теме.",
    progress: "Прогресс",
    addTask: "Добавить задачу",
    addMaterial: "Добавить материал",
    fieldTitle: "Название",
    fieldDescription: "Описание",
    fieldDeadline: "Дедлайн",
    fieldType: "Тип",
    fieldUnit: "Единица",
    fieldTotalAmount: "Полная мера",
    fieldCompletedAmount: "Выполнено",
    fieldPosition: "Позиция",
    taskPlaceholderTitle: "Например: Разобрать flex/grid кейсы",
    taskPlaceholderDescription: "Краткое описание задачи (опционально)",
    materialPlaceholderTitle: "Название материала",
    materialPlaceholderDescription: "Описание материала",
    createButton: "Создать",
    creatingButton: "Создание...",
    closeModalAria: "Закрыть",
    taskTitleRequired: "Название задачи обязательно.",
    taskCreateFailed: "Не удалось создать задачу.",
    materialTitleDescRequired: "Название и описание обязательны.",
    materialAmountInvalid: "Выполненная мера должна быть меньше или равна полной мере.",
    materialCreateFailed: "Не удалось создать материал.",
    typeBook: "Книга",
    typeArticle: "Статья",
    typeCourse: "Курс",
    typeVideo: "Видео",
    unitPages: "страницы",
    unitLessons: "уроки",
    unitHours: "часы"
  },
  en: {
    loading: "Loading topic workspace...",
    loadError: "Topic workspace failed to load.",
    retry: "Retry",
    emptyTitle: "No topic selected",
    emptyDescription:
      "Open the roadmap and choose a topic to see its workspace, checklist, and materials.",
    openRoadmap: "Open roadmap",
    notSet: "Not set",
    topicProgress: "Topic progress",
    startDate: "Start date",
    targetDate: "Target date",
    completedAt: "Completed at",
    dependenciesTitle: "Dependencies",
    dependenciesSummary: (completed: number, pending: number) =>
      `Completed: ${completed} · Pending: ${pending}`,
    noDependencies: "No dependencies for this topic.",
    addDependency: "Add dependency",
    removeDependency: "Remove",
    selectTopic: "Select topic...",
    dependencyRequired: "Required dependency",
    dependencyOptional: "Optional dependency",
    dependencyReady: "Ready",
    dependencyPending: "Pending",
    checklistTitle: "Checklist / Tasks",
    checklistSubtitle: "Track task completion for this topic.",
    checklistEmpty: "Checklist is empty for this topic.",
    statusLabel: "Status",
    materialsTitle: "Materials",
    materialsSubtitle: "Learning resources, ordered by position.",
    materialsEmpty: "No materials in this topic yet.",
    progress: "Progress",
    addTask: "Add task",
    addMaterial: "Add material",
    fieldTitle: "Title",
    fieldDescription: "Description",
    fieldDeadline: "Deadline",
    fieldType: "Type",
    fieldUnit: "Unit",
    fieldTotalAmount: "Total amount",
    fieldCompletedAmount: "Completed",
    fieldPosition: "Position",
    taskPlaceholderTitle: "e.g.: Review flex/grid cases",
    taskPlaceholderDescription: "Brief description (optional)",
    materialPlaceholderTitle: "Material title",
    materialPlaceholderDescription: "Material description",
    createButton: "Create",
    creatingButton: "Creating...",
    closeModalAria: "Close",
    taskTitleRequired: "Task title is required.",
    taskCreateFailed: "Failed to create task.",
    materialTitleDescRequired: "Title and description are required.",
    materialAmountInvalid: "Completed amount must be less than or equal to total amount.",
    materialCreateFailed: "Failed to create material.",
    typeBook: "Book",
    typeArticle: "Article",
    typeCourse: "Course",
    typeVideo: "Video",
    unitPages: "pages",
    unitLessons: "lessons",
    unitHours: "hours"
  }
} as const;

type TopicCopy = (typeof TOPIC_COPY)[keyof typeof TOPIC_COPY];

function getMaterialTypeLabel(copy: TopicCopy, type: MaterialType): string {
  if (type === "book") return copy.typeBook;
  if (type === "article") return copy.typeArticle;
  if (type === "course") return copy.typeCourse;
  return copy.typeVideo;
}

function getMaterialUnitLabel(copy: TopicCopy, unit: MaterialUnit): string {
  if (unit === "hours") return copy.unitHours;
  if (unit === "lessons") return copy.unitLessons;
  return copy.unitPages;
}

function formatDate(value: string | null, language: AppLanguage, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function mapTopicStatusLabel(status: TopicWorkspaceStatus, language: AppLanguage): string {
  if (language === "ru") {
    if (status === "completed") return "Выполнено";
    if (status === "in_progress") return "В работе";
    if (status === "paused") return "На паузе";
    return "Не начато";
  }

  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  if (status === "paused") return "Paused";
  return "Not started";
}

function mapTopicStatusClassName(status: TopicWorkspaceStatus): string {
  if (status === "completed") return "roadmap-status-completed";
  if (status === "in_progress") return "roadmap-status-in-progress";
  if (status === "paused") return "roadmap-status-paused";
  return "roadmap-status-not-started";
}

function mapChecklistStatusLabel(status: TopicChecklistStatus, language: AppLanguage): string {
  if (language === "ru") {
    if (status === "done") return "Сделано";
    if (status === "in_progress") return "В работе";
    return "К выполнению";
  }

  if (status === "done") return "Done";
  if (status === "in_progress") return "In progress";
  return "Todo";
}

function mapChecklistStatusClassName(status: TopicChecklistStatus): string {
  if (status === "done") return "roadmap-status-completed";
  if (status === "in_progress") return "roadmap-status-in-progress";
  return "roadmap-status-not-started";
}

function TopicHeroPanel({
  topic,
  copy,
  language,
  handleUpdateDates
}: {
  topic: TopicWorkspace;
  copy: TopicCopy;
  language: AppLanguage;
  handleUpdateDates: (dates: { startDate?: string | null; targetDate?: string | null }) => void;
}) {
  return (
    <section className="topic-hero panel">
      <div className="topic-hero-head">
        <span className={`roadmap-status-badge ${mapTopicStatusClassName(topic.status)}`}>
          {mapTopicStatusLabel(topic.status, language)}
        </span>
      </div>
      <h2>{topic.title}</h2>
      <p>{topic.description}</p>

      {topic.goal ? (
        <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", fontStyle: "italic", marginTop: "0.25rem" }}>
          {topic.goal}
        </p>
      ) : (
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", opacity: 0.7, marginTop: "0.25rem" }}>
          {language === "ru" ? "Добавьте цель — это поможет оставаться в фокусе" : "Add a goal to stay focused"}
        </p>
      )}

      {topic.status === "completed" && topic.confidence !== null && (
        <div style={{ marginTop: "0.25rem", display: "flex", gap: "0.15rem" }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} style={{ fontSize: "1rem", color: star <= (topic.confidence ?? 0) ? "#f59e0b" : "#d1d5db" }}>
              ★
            </span>
          ))}
          <span style={{ marginLeft: "0.25rem", fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            {(language === "ru"
              ? ["Поверхностно", "Знаю основы", "Понимаю", "Уверенно", "Могу объяснить"]
              : ["Scratched surface", "Know basics", "Understand", "Confident", "Can teach"]
            )[(topic.confidence ?? 1) - 1]}
          </span>
        </div>
      )}

      <div className="topic-progress-wrap">
        <div className="topic-progress-head">
          <span>{copy.topicProgress}</span>
          <strong>{topic.progressPercent}%</strong>
        </div>
        <div className="roadmap-progress-track">
          <span className="roadmap-progress-fill" style={{ width: `${topic.progressPercent}%` }} />
        </div>
      </div>

      <div className="topic-date-grid">
        <label>
          <span>{copy.startDate}</span>
          <input
            type="date"
            className="input"
            value={topic.startDate ?? ""}
            onChange={(event) =>
              handleUpdateDates({ startDate: event.target.value || null })
            }
          />
        </label>
        <label>
          <span>{copy.targetDate}</span>
          <input
            type="date"
            className="input"
            value={topic.targetDate ?? ""}
            onChange={(event) =>
              handleUpdateDates({ targetDate: event.target.value || null })
            }
          />
        </label>
        <div>
          <span>{copy.completedAt}</span>
          <strong>{formatDate(topic.completedAt, language, copy.notSet)}</strong>
        </div>
      </div>
    </section>
  );
}

function TopicDependenciesPanel({
  topic,
  copy,
  completed,
  pending,
  dependencyOptions,
  onAddDependency,
  onRemoveDependency
}: {
  topic: TopicWorkspace;
  copy: TopicCopy;
  completed: number;
  pending: number;
  dependencyOptions: Array<{ id: string; title: string }>;
  onAddDependency: (topicId: string) => void;
  onRemoveDependency: (topicId: string) => void;
}) {
  return (
    <aside className="topic-dependencies panel">
      <header>
        <h3>{copy.dependenciesTitle}</h3>
        <p>{copy.dependenciesSummary(completed, pending)}</p>
      </header>
      {topic.dependencies.length === 0 ? (
        <p className="dashboard-empty">{copy.noDependencies}</p>
      ) : (
        <ul className="topic-dependency-list">
          {topic.dependencies.map((dependency) => (
            <li key={dependency.topicId} className="topic-dependency-item">
              <div>
                <p className="topic-dependency-title">{dependency.title}</p>
                <p className="topic-dependency-subtitle">
                  {dependency.isRequired ? copy.dependencyRequired : copy.dependencyOptional}
                </p>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {dependency.isCompleted ? (
                  <span className="roadmap-status-badge roadmap-status-completed">
                    {copy.dependencyReady}
                  </span>
                ) : (
                  <span className="roadmap-pending-badge">{copy.dependencyPending}</span>
                )}
                <button
                  type="button"
                  className="button button-outline"
                  style={{ fontSize: "0.72rem", padding: "2px 8px", height: "auto" }}
                  onClick={() => onRemoveDependency(dependency.topicId)}
                >
                  {copy.removeDependency}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dependencyOptions.length > 0 ? (
        <div style={{ marginTop: "8px" }}>
          <select
            className="input"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) {
                onAddDependency(event.target.value);
                event.target.value = "";
              }
            }}
          >
            <option value="" disabled>
              {copy.addDependency}
            </option>
            {dependencyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </aside>
  );
}

function TopicTaskCreateForm({
  copy,
  draft,
  setDraft,
  isCreating,
  onSubmit
}: {
  copy: TopicCopy;
  draft: TopicTaskDraft;
  setDraft: Dispatch<SetStateAction<TopicTaskDraft>>;
  isCreating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="topic-inline-create-form" onSubmit={onSubmit}>
      <label className="topic-inline-field topic-inline-field-title">
        <span>{copy.fieldTitle}</span>
        <input
          type="text"
          className="input"
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          placeholder={copy.taskPlaceholderTitle}
        />
      </label>

      <label className="topic-inline-field">
        <span>{copy.fieldDeadline}</span>
        <input
          type="date"
          className="input"
          value={draft.deadline}
          onChange={(event) =>
            setDraft((current) => ({ ...current, deadline: event.target.value }))
          }
        />
      </label>

      <label className="topic-inline-field topic-inline-field-description">
        <span>{copy.fieldDescription}</span>
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
          placeholder={copy.taskPlaceholderDescription}
        />
      </label>

      <button type="submit" className="button button-primary" disabled={isCreating}>
        {isCreating ? copy.creatingButton : copy.createButton}
      </button>
    </form>
  );
}

function TopicMaterialCreateForm({
  copy,
  draft,
  setDraft,
  isCreating,
  onSubmit
}: {
  copy: TopicCopy;
  draft: TopicMaterialDraft;
  setDraft: Dispatch<SetStateAction<TopicMaterialDraft>>;
  isCreating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="topic-inline-create-form" onSubmit={onSubmit}>
      <label className="topic-inline-field topic-inline-field-title">
        <span>{copy.fieldTitle}</span>
        <input
          type="text"
          className="input"
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          placeholder={copy.materialPlaceholderTitle}
        />
      </label>

      <label className="topic-inline-field">
        <span>{copy.fieldType}</span>
        <select
          className="input"
          value={draft.type}
          onChange={(event) => {
            const nextType = event.target.value as MaterialType;
            setDraft((current) => ({
              ...current,
              type: nextType,
              unit: resolveUnitByType(nextType)
            }));
          }}
        >
          {MATERIAL_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {getMaterialTypeLabel(copy, type)}
            </option>
          ))}
        </select>
      </label>

      <label className="topic-inline-field">
        <span>{copy.fieldUnit}</span>
        <input
          type="text"
          className="input"
          value={getMaterialUnitLabel(copy, draft.unit as MaterialUnit)}
          readOnly
          disabled
        />
      </label>

      <label className="topic-inline-field">
        <span>{copy.fieldTotalAmount}</span>
        <input
          type="number"
          min={0}
          className="input"
          value={draft.totalAmount}
          onChange={(event) =>
            setDraft((current) => ({ ...current, totalAmount: event.target.value }))
          }
        />
      </label>

      <label className="topic-inline-field">
        <span>{copy.fieldCompletedAmount}</span>
        <input
          type="number"
          min={0}
          className="input"
          value={draft.completedAmount}
          onChange={(event) =>
            setDraft((current) => ({ ...current, completedAmount: event.target.value }))
          }
        />
      </label>

      <label className="topic-inline-field">
        <span>{copy.fieldPosition}</span>
        <input
          type="number"
          min={1}
          className="input"
          value={draft.position}
          onChange={(event) =>
            setDraft((current) => ({ ...current, position: event.target.value }))
          }
        />
      </label>

      <label className="topic-inline-field topic-inline-field-description">
        <span>{copy.fieldDescription}</span>
        <textarea
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
          placeholder={copy.materialPlaceholderDescription}
        />
      </label>

      <button type="submit" className="button button-primary" disabled={isCreating}>
        {isCreating ? copy.creatingButton : copy.createButton}
      </button>
    </form>
  );
}

function TopicChecklistPanel({
  topic,
  copy,
  language,
  taskDraft,
  setTaskDraft,
  isCreatingTask,
  taskMutationError,
  clearTaskMutationError,
  onCreateTask
}: {
  topic: TopicWorkspace;
  copy: TopicCopy;
  language: AppLanguage;
  taskDraft: TopicTaskDraft;
  setTaskDraft: Dispatch<SetStateAction<TopicTaskDraft>>;
  isCreatingTask: boolean;
  taskMutationError: string | null;
  clearTaskMutationError: () => void;
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const modalTitleId = "topic-task-create-modal-title";
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isFormOpen) return;

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape" && !isCreatingTask) {
        clearTaskMutationError();
        setIsFormOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFormOpen, isCreatingTask, clearTaskMutationError]);

  function closeModal() {
    if (isCreatingTask) return;
    clearTaskMutationError();
    setIsFormOpen(false);
    triggerRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const created = await onCreateTask(event);
    if (created) {
      clearTaskMutationError();
      setIsFormOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <section className="topic-checklist panel">
      <header>
        <div className="topic-panel-header-row">
          <div>
            <h3>{copy.checklistTitle}</h3>
            <p>{copy.checklistSubtitle}</p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="button button-primary topic-panel-add-button"
            onClick={() => {
              clearTaskMutationError();
              setIsFormOpen(true);
            }}
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            {copy.addTask}
          </button>
        </div>
      </header>

      {isFormOpen ? (
        <div className="roadmap-modal-overlay" role="presentation" onClick={closeModal}>
          <section
            className="roadmap-modal topic-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="roadmap-modal-header">
              <h4 id={modalTitleId}>{copy.addTask}</h4>
              <button
                type="button"
                className="roadmap-modal-close"
                aria-label={copy.closeModalAria}
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <TopicTaskCreateForm
              copy={copy}
              draft={taskDraft}
              setDraft={setTaskDraft}
              isCreating={isCreatingTask}
              onSubmit={handleSubmit}
            />
            {taskMutationError ? (
              <div className="dashboard-error">
                <p>{taskMutationError}</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {topic.checklist.length === 0 ? (
        <p className="dashboard-empty">{copy.checklistEmpty}</p>
      ) : (
        <ul className="topic-checklist-list">
          {topic.checklist.map((item) => (
            <li key={item.id} className="topic-checklist-item">
              <div>
                <p className="topic-checklist-title">{item.title}</p>
                <p className="topic-checklist-description">{item.description}</p>
              </div>
              <div className="topic-checklist-select-wrap">
                <span>{copy.statusLabel}</span>
                <span
                  className={`roadmap-status-badge ${mapChecklistStatusClassName(item.status)}`}
                >
                  {mapChecklistStatusLabel(item.status, language)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopicMaterialsPanel({
  topic,
  copy,
  materialDraft,
  setMaterialDraft,
  isCreatingMaterial,
  materialMutationError,
  clearMaterialMutationError,
  onCreateMaterial
}: {
  topic: TopicWorkspace;
  copy: TopicCopy;
  materialDraft: TopicMaterialDraft;
  setMaterialDraft: Dispatch<SetStateAction<TopicMaterialDraft>>;
  isCreatingMaterial: boolean;
  materialMutationError: string | null;
  clearMaterialMutationError: () => void;
  onCreateMaterial: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const modalTitleId = "topic-material-create-modal-title";
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isFormOpen) return;

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape" && !isCreatingMaterial) {
        clearMaterialMutationError();
        setIsFormOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFormOpen, isCreatingMaterial, clearMaterialMutationError]);

  function closeModal() {
    if (isCreatingMaterial) return;
    clearMaterialMutationError();
    setIsFormOpen(false);
    triggerRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const created = await onCreateMaterial(event);
    if (created) {
      clearMaterialMutationError();
      setIsFormOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <section className="topic-materials panel">
      <header>
        <div className="topic-panel-header-row">
          <div>
            <h3>{copy.materialsTitle}</h3>
            <p>{copy.materialsSubtitle}</p>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="button button-primary topic-panel-add-button"
            onClick={() => {
              clearMaterialMutationError();
              setIsFormOpen(true);
            }}
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            {copy.addMaterial}
          </button>
        </div>
      </header>

      {isFormOpen ? (
        <div className="roadmap-modal-overlay" role="presentation" onClick={closeModal}>
          <section
            className="roadmap-modal topic-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="roadmap-modal-header">
              <h4 id={modalTitleId}>{copy.addMaterial}</h4>
              <button
                type="button"
                className="roadmap-modal-close"
                aria-label={copy.closeModalAria}
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <TopicMaterialCreateForm
              copy={copy}
              draft={materialDraft}
              setDraft={setMaterialDraft}
              isCreating={isCreatingMaterial}
              onSubmit={handleSubmit}
            />
            {materialMutationError ? (
              <div className="dashboard-error">
                <p>{materialMutationError}</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {topic.materials.length === 0 ? (
        <p className="dashboard-empty">{copy.materialsEmpty}</p>
      ) : (
        <ul className="topic-materials-list">
          {topic.materials.map((material) => (
            <li key={material.id} className="topic-material-item">
              <div className="topic-material-head">
                <span className="topic-material-position">#{material.position}</span>
                <p className="topic-material-title">{material.title}</p>
              </div>
              <p className="topic-material-description">{material.description}</p>
              <div className="topic-material-progress">
                <span>{copy.progress}</span>
                <strong>{material.progressPercent}%</strong>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TopicWorkspaceView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useUserPreferences();
  const copy = TOPIC_COPY[language];
  const topicId = searchParams.get("topicId")?.trim() || null;
  const {
    state,
    reload,
    dependencySummary,
    taskDraft,
    setTaskDraft,
    isCreatingTask,
    taskMutationError,
    clearTaskMutationError,
    handleCreateTask,
    materialDraft,
    setMaterialDraft,
    isCreatingMaterial,
    materialMutationError,
    clearMaterialMutationError,
    handleCreateMaterial,
    handleUpdateDates,
    handleAddDependency,
    handleRemoveDependency,
    dependencyOptions
  } = useTopicWorkspaceViewModel(topicId, {
    loadError: copy.loadError,
    taskTitleRequired: copy.taskTitleRequired,
    taskCreateFailed: copy.taskCreateFailed,
    materialTitleDescRequired: copy.materialTitleDescRequired,
    materialAmountInvalid: copy.materialAmountInvalid,
    materialCreateFailed: copy.materialCreateFailed
  });

  if (!topicId) {
    return (
      <section className="topic-workspace-view">
        <section className="panel topic-empty-panel">
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyDescription}</p>
          <button
            type="button"
            className="button button-outline topic-empty-action"
            onClick={() => router.push("/roadmap")}
          >
            {copy.openRoadmap}
          </button>
        </section>
      </section>
    );
  }

  return (
    <section className="topic-workspace-view">
      {state.status === "loading" ? (
        <section className="panel topic-loading-panel">
          <p className="topic-loading-title">{copy.loading}</p>
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="panel topic-error-panel">
          <div className="dashboard-error">
            <p>{state.errorMessage ?? copy.loadError}</p>
            <button type="button" className="button button-outline dashboard-retry" onClick={reload}>
              {copy.retry}
            </button>
          </div>
        </section>
      ) : null}

      {state.status === "success" && state.data ? (
        <div className="topic-workspace-layout">
          <TopicHeroPanel topic={state.data} copy={copy} language={language} handleUpdateDates={handleUpdateDates} />

          <div className="topic-grid">
            <TopicDependenciesPanel
              topic={state.data}
              copy={copy}
              completed={dependencySummary.completed}
              pending={dependencySummary.pending}
              dependencyOptions={dependencyOptions}
              onAddDependency={handleAddDependency}
              onRemoveDependency={handleRemoveDependency}
            />
            <TopicChecklistPanel
              topic={state.data}
              copy={copy}
              language={language}
              taskDraft={taskDraft}
              setTaskDraft={setTaskDraft}
              isCreatingTask={isCreatingTask}
              taskMutationError={taskMutationError}
              clearTaskMutationError={clearTaskMutationError}
              onCreateTask={handleCreateTask}
            />
            <TopicMaterialsPanel
              topic={state.data}
              copy={copy}
              materialDraft={materialDraft}
              setMaterialDraft={setMaterialDraft}
              isCreatingMaterial={isCreatingMaterial}
              materialMutationError={materialMutationError}
              clearMaterialMutationError={clearMaterialMutationError}
              onCreateMaterial={handleCreateMaterial}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
