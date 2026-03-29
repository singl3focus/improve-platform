"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { TopicNotes } from "@features/topics/components/topic-notes";
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

const COPY = {
  ru: {
    loading: "Загрузка рабочего пространства темы...",
    loadError: "Не удалось загрузить рабочее пространство темы.",
    retry: "Повторить",
    emptyTitle: "Тема не выбрана",
    emptyDescription:
      "Откройте roadmap и выберите тему, чтобы увидеть рабочее пространство, чеклист и материалы.",
    openRoadmap: "Открыть roadmap",
    notSet: "Не задано",
    progress: "Прогресс темы",
    startDate: "Дата начала",
    targetDate: "Целевая дата",
    completedAt: "Завершено",
    dependenciesTitle: "Зависимости",
    dependenciesSummary: (done: number, pending: number) => `Выполнено: ${done} · Ожидают: ${pending}`,
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
    unitHours: "часы",
    eyebrow: "Рабочее пространство темы",
    focusLabel: "Фокус темы",
    statsTasks: "Задач",
    statsMaterials: "Материалов",
    statsDependencies: "Зависимостей",
    rhythmLabel: "Ритм",
    confidenceLabel: "Уверенность",
    confidenceEmpty: "Появится после завершения темы"
  },
  en: {
    loading: "Loading topic workspace...",
    loadError: "Topic workspace failed to load.",
    retry: "Retry",
    emptyTitle: "No topic selected",
    emptyDescription: "Open the roadmap and choose a topic to see its workspace, checklist, and materials.",
    openRoadmap: "Open roadmap",
    notSet: "Not set",
    progress: "Topic progress",
    startDate: "Start date",
    targetDate: "Target date",
    completedAt: "Completed at",
    dependenciesTitle: "Dependencies",
    dependenciesSummary: (done: number, pending: number) => `Completed: ${done} · Pending: ${pending}`,
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
    unitHours: "hours",
    eyebrow: "Topic workspace",
    focusLabel: "Topic focus",
    statsTasks: "Tasks",
    statsMaterials: "Materials",
    statsDependencies: "Dependencies",
    rhythmLabel: "Rhythm",
    confidenceLabel: "Confidence",
    confidenceEmpty: "Available after the topic is completed"
  }
} as const;

type TopicCopy = (typeof COPY)[keyof typeof COPY];

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

function getTopicStatusLabel(status: TopicWorkspaceStatus, language: AppLanguage): string {
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

function getTopicStatusClassName(status: TopicWorkspaceStatus): string {
  if (status === "completed") return "roadmap-status-completed";
  if (status === "in_progress") return "roadmap-status-in-progress";
  if (status === "paused") return "roadmap-status-paused";
  return "roadmap-status-not-started";
}

function getChecklistStatusLabel(status: TopicChecklistStatus, language: AppLanguage): string {
  if (language === "ru") {
    if (status === "done") return "Сделано";
    if (status === "in_progress") return "В работе";
    return "К выполнению";
  }
  if (status === "done") return "Done";
  if (status === "in_progress") return "In progress";
  return "Todo";
}

function getChecklistStatusClassName(status: TopicChecklistStatus): string {
  if (status === "done") return "roadmap-status-completed";
  if (status === "in_progress") return "roadmap-status-in-progress";
  return "roadmap-status-not-started";
}

function getConfidenceLabel(language: AppLanguage, confidence: number | null): string | null {
  if (confidence === null) return null;
  const labels =
    language === "ru"
      ? ["Поверхностно", "Знаю основы", "Понимаю", "Уверенно", "Могу объяснить"]
      : ["Scratched surface", "Know basics", "Understand", "Confident", "Can teach"];
  return labels[Math.max(0, Math.min(labels.length - 1, confidence - 1))] ?? null;
}

function formatDate(value: string | null, language: AppLanguage, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
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
  const confidenceLabel = getConfidenceLabel(language, topic.confidence);
  const [startDateValue, setStartDateValue] = useState(topic.startDate ?? "");
  const [targetDateValue, setTargetDateValue] = useState(topic.targetDate ?? "");

  useEffect(() => {
    setStartDateValue(topic.startDate ?? "");
  }, [topic.startDate]);

  useEffect(() => {
    setTargetDateValue(topic.targetDate ?? "");
  }, [topic.targetDate]);

  return (
    <section className="topic-hero panel">
      <header className="topic-hero-head">
        <div className="topic-hero-heading">
          <p className="dashboard-eyebrow">{copy.eyebrow}</p>
          <h2>{topic.title}</h2>
        </div>
        <div className="topic-hero-status-row">
          <span className={`roadmap-status-badge ${getTopicStatusClassName(topic.status)}`}>
            {getTopicStatusLabel(topic.status, language)}
          </span>
          <span className="topic-inline-stat">{topic.progressPercent}%</span>
        </div>
      </header>

      <div className="topic-hero-grid">
        <div className="topic-hero-copy">
          <p className="topic-hero-description">{topic.description}</p>
          <section className="topic-focus-card">
            <p className="topic-card-kicker">{copy.focusLabel}</p>
            <p className={`topic-focus-copy ${topic.goal ? "" : "topic-focus-copy-muted"}`}>
              {topic.goal || copy.notSet}
            </p>
          </section>
          <div className="topic-stat-grid">
            <article className="topic-stat-card">
              <span>{copy.statsTasks}</span>
              <strong>{topic.checklist.length}</strong>
            </article>
            <article className="topic-stat-card">
              <span>{copy.statsMaterials}</span>
              <strong>{topic.materials.length}</strong>
            </article>
            <article className="topic-stat-card">
              <span>{copy.statsDependencies}</span>
              <strong>{topic.dependencies.length}</strong>
            </article>
          </div>
        </div>

        <aside className="topic-hero-sidebar">
          <section className="topic-progress-wrap">
            <div className="topic-progress-head">
              <span>{copy.progress}</span>
              <strong>{topic.progressPercent}%</strong>
            </div>
            <div className="roadmap-progress-track">
              <span className="roadmap-progress-fill" style={{ width: `${topic.progressPercent}%` }} />
            </div>
          </section>

          <section className="topic-confidence-card">
            <p className="topic-card-kicker">{copy.confidenceLabel}</p>
            {topic.status === "completed" && topic.confidence !== null ? (
              <>
                <div className="topic-confidence-stars" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`topic-confidence-star ${star <= (topic.confidence ?? 0) ? "topic-confidence-star-active" : ""}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="topic-confidence-label">{confidenceLabel}</p>
              </>
            ) : (
              <p className="topic-confidence-label topic-confidence-label-muted">{copy.confidenceEmpty}</p>
            )}
          </section>

          <section className="topic-dates-card">
            <p className="topic-card-kicker">{copy.rhythmLabel}</p>
            <div className="topic-date-grid">
              <label>
                <span>{copy.startDate}</span>
                <input
                  type="date"
                  className="input"
                  value={startDateValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setStartDateValue(nextValue);
                    handleUpdateDates({ startDate: nextValue || null });
                  }}
                />
              </label>
              <label>
                <span>{copy.targetDate}</span>
                <input
                  type="date"
                  className="input"
                  value={targetDateValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setTargetDateValue(nextValue);
                    handleUpdateDates({ targetDate: nextValue || null });
                  }}
                />
              </label>
              <div className="topic-date-summary">
                <span>{copy.completedAt}</span>
                <strong>{formatDate(topic.completedAt, language, copy.notSet)}</strong>
              </div>
            </div>
          </section>
        </aside>
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
        <p className="topic-card-kicker">{copy.dependenciesTitle}</p>
        <h3>{copy.dependenciesTitle}</h3>
        <p>{copy.dependenciesSummary(completed, pending)}</p>
      </header>
      {topic.dependencies.length === 0 ? <p className="dashboard-empty">{copy.noDependencies}</p> : null}
      {topic.dependencies.length > 0 ? (
        <ul className="topic-dependency-list">
          {topic.dependencies.map((dependency) => (
            <li key={dependency.topicId} className="topic-dependency-item">
              <div className="topic-dependency-copy">
                <p className="topic-dependency-title">{dependency.title}</p>
                <p className="topic-dependency-subtitle">
                  {dependency.isRequired ? copy.dependencyRequired : copy.dependencyOptional}
                </p>
              </div>
              <div className="topic-dependency-actions">
                {dependency.isCompleted ? (
                  <span className="roadmap-status-badge roadmap-status-completed">{copy.dependencyReady}</span>
                ) : (
                  <span className="roadmap-pending-badge">{copy.dependencyPending}</span>
                )}
                <button type="button" className="button button-outline topic-ghost-action" onClick={() => onRemoveDependency(dependency.topicId)}>
                  {copy.removeDependency}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {dependencyOptions.length > 0 ? (
        <label className="topic-dependency-add">
          <span>{copy.addDependency}</span>
          <select
            className="input"
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              onAddDependency(event.target.value);
              event.target.value = "";
            }}
          >
            <option value="" disabled>
              {copy.selectTopic}
            </option>
            {dependencyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </aside>
  );
}

function TaskCreateForm({
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
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          placeholder={copy.taskPlaceholderTitle}
        />
      </label>
      <label className="topic-inline-field">
        <span>{copy.fieldDeadline}</span>
        <input
          type="date"
          className="input"
          value={draft.deadline}
          onChange={(event) => setDraft((current) => ({ ...current, deadline: event.target.value }))}
        />
      </label>
      <label className="topic-inline-field topic-inline-field-description">
        <span>{copy.fieldDescription}</span>
        <textarea
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          placeholder={copy.taskPlaceholderDescription}
        />
      </label>
      <button type="submit" className="button button-primary" disabled={isCreating}>
        {isCreating ? copy.creatingButton : copy.createButton}
      </button>
    </form>
  );
}

function MaterialCreateForm({
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
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
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
            setDraft((current) => ({ ...current, type: nextType, unit: resolveUnitByType(nextType) }));
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
          onChange={(event) => setDraft((current) => ({ ...current, totalAmount: event.target.value }))}
        />
      </label>
      <label className="topic-inline-field">
        <span>{copy.fieldCompletedAmount}</span>
        <input
          type="number"
          min={0}
          className="input"
          value={draft.completedAmount}
          onChange={(event) => setDraft((current) => ({ ...current, completedAmount: event.target.value }))}
        />
      </label>
      <label className="topic-inline-field">
        <span>{copy.fieldPosition}</span>
        <input
          type="number"
          min={1}
          className="input"
          value={draft.position}
          onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))}
        />
      </label>
      <label className="topic-inline-field topic-inline-field-description">
        <span>{copy.fieldDescription}</span>
        <textarea
          value={draft.description}
          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const created = await onCreateTask(event);
    if (!created) return;
    clearTaskMutationError();
    setIsFormOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <section className="topic-checklist panel">
      <header className="topic-panel-header-row">
        <div>
          <p className="topic-card-kicker">{copy.checklistTitle}</p>
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
      </header>
      {isFormOpen ? (
        <div className="roadmap-modal-overlay" role="presentation" onClick={() => setIsFormOpen(false)}>
          <section className="roadmap-modal topic-create-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="roadmap-modal-header">
              <h4>{copy.addTask}</h4>
              <button type="button" className="roadmap-modal-close" aria-label={copy.closeModalAria} onClick={() => setIsFormOpen(false)}>
                ×
              </button>
            </div>
            <TaskCreateForm copy={copy} draft={taskDraft} setDraft={setTaskDraft} isCreating={isCreatingTask} onSubmit={handleSubmit} />
            {taskMutationError ? <div className="dashboard-error"><p>{taskMutationError}</p></div> : null}
          </section>
        </div>
      ) : null}
      {topic.checklist.length === 0 ? <p className="dashboard-empty">{copy.checklistEmpty}</p> : null}
      {topic.checklist.length > 0 ? (
        <ul className="topic-checklist-list">
          {topic.checklist.map((item, index) => (
            <li key={item.id} className="topic-checklist-item">
              <div className="topic-checklist-main">
                <span className="topic-item-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="topic-checklist-title">{item.title}</p>
                  <p className="topic-checklist-description">{item.description}</p>
                </div>
              </div>
              <div className="topic-checklist-meta">
                <span>{copy.statusLabel}</span>
                <span className={`roadmap-status-badge ${getChecklistStatusClassName(item.status)}`}>
                  {getChecklistStatusLabel(item.status, language)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const created = await onCreateMaterial(event);
    if (!created) return;
    clearMaterialMutationError();
    setIsFormOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <section className="topic-materials panel">
      <header className="topic-panel-header-row">
        <div>
          <p className="topic-card-kicker">{copy.materialsTitle}</p>
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
      </header>
      {isFormOpen ? (
        <div className="roadmap-modal-overlay" role="presentation" onClick={() => setIsFormOpen(false)}>
          <section className="roadmap-modal topic-create-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="roadmap-modal-header">
              <h4>{copy.addMaterial}</h4>
              <button type="button" className="roadmap-modal-close" aria-label={copy.closeModalAria} onClick={() => setIsFormOpen(false)}>
                ×
              </button>
            </div>
            <MaterialCreateForm copy={copy} draft={materialDraft} setDraft={setMaterialDraft} isCreating={isCreatingMaterial} onSubmit={handleSubmit} />
            {materialMutationError ? <div className="dashboard-error"><p>{materialMutationError}</p></div> : null}
          </section>
        </div>
      ) : null}
      {topic.materials.length === 0 ? <p className="dashboard-empty">{copy.materialsEmpty}</p> : null}
      {topic.materials.length > 0 ? (
        <ul className="topic-materials-list">
          {topic.materials.map((material) => (
            <li key={material.id} className="topic-material-item">
              <div className="topic-material-head">
                <span className="topic-material-position">#{material.position}</span>
                <div className="topic-material-copy">
                  <p className="topic-material-title">{material.title}</p>
                  <p className="topic-material-description">{material.description}</p>
                </div>
              </div>
              <div className="topic-material-progress-row">
                <span>{copy.progress}</span>
                <strong>{material.progressPercent}%</strong>
              </div>
              <div className="roadmap-progress-track">
                <span className="roadmap-progress-fill" style={{ width: `${material.progressPercent}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function TopicWorkspaceView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useUserPreferences();
  const copy = COPY[language];
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
      <section className="topic-workspace-view topic-workspace-view-empty">
        <section className="panel topic-empty-panel">
          <p className="dashboard-eyebrow">{copy.eyebrow}</p>
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyDescription}</p>
          <button type="button" className="button button-outline topic-empty-action" onClick={() => router.push("/roadmap")}>
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
          <div className="dashboard-loading" aria-hidden="true"><span /><span /><span /></div>
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
            <div className="topic-grid-stack">
              <TopicDependenciesPanel
                topic={state.data}
                copy={copy}
                completed={dependencySummary.completed}
                pending={dependencySummary.pending}
                dependencyOptions={dependencyOptions}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
              />
              <TopicNotes topicId={topicId} />
            </div>
            <div className="topic-grid-main">
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
        </div>
      ) : null}
    </section>
  );
}
