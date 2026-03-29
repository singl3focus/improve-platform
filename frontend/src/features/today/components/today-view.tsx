"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useTodayViewModel } from "@features/today/hooks/use-today-view-model";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import type { TodayMaterial, TodayTask } from "@features/today/types";

function formatDate(dateStr: string, lang: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${deadline}T00:00:00`) < today;
}

interface TodayCopy {
  header: (date: string) => string;
  sectionKicker: string;
  focusTasks: string;
  noTasks: string;
  currentMaterial: string;
  reflection: string;
  reflectionPlaceholder: string;
  reflectionSave: string;
  reflectionSaving: string;
  loading: string;
  error: string;
  checkTask: string;
  uncheckTask: string;
  materialBook: string;
  materialArticle: string;
  materialCourse: string;
  materialVideo: string;
  quickAddLabel: string;
  quickAddPlaceholder: string;
  quickAddSubmit: string;
  quickAddSubmitting: string;
  quickAddError: string;
  tasksCounter: (completed: number, total: number) => string;
}

const RU_TODAY_COPY: TodayCopy = {
  header: (date) => `Сегодня, ${date}`,
  sectionKicker: "Daily rhythm",
  focusTasks: "Задачи на сегодня",
  noTasks: "На сегодня задач нет. Добавьте первую задачу и соберите свой рабочий ритм.",
  currentMaterial: "Текущий материал",
  reflection: "Микро-рефлексия",
  reflectionPlaceholder: "Что я понял сегодня и что стоит продолжить завтра?",
  reflectionSave: "Сохранить",
  reflectionSaving: "Сохраняю...",
  loading: "Загрузка...",
  error: "Не удалось загрузить данные.",
  checkTask: "Отметить как выполненную",
  uncheckTask: "Снять отметку",
  materialBook: "Книга",
  materialArticle: "Статья",
  materialCourse: "Курс",
  materialVideo: "Видео",
  quickAddLabel: "Новая задача дня",
  quickAddPlaceholder: "Добавить задачу в сегодняшний поток",
  quickAddSubmit: "Добавить",
  quickAddSubmitting: "Добавление...",
  quickAddError: "Не удалось добавить задачу.",
  tasksCounter: (completed, total) => `${completed} из ${total} выполнено`
};

const EN_TODAY_COPY: TodayCopy = {
  header: (date) => `Today, ${date}`,
  sectionKicker: "Daily rhythm",
  focusTasks: "Today's tasks",
  noTasks: "No tasks for today yet. Add the first one and shape the day's flow.",
  currentMaterial: "Current material",
  reflection: "Micro-reflection",
  reflectionPlaceholder: "What clicked today, and what should continue tomorrow?",
  reflectionSave: "Save",
  reflectionSaving: "Saving...",
  loading: "Loading...",
  error: "Failed to load data.",
  checkTask: "Mark as complete",
  uncheckTask: "Uncheck task",
  materialBook: "Book",
  materialArticle: "Article",
  materialCourse: "Course",
  materialVideo: "Video",
  quickAddLabel: "New task for today",
  quickAddPlaceholder: "Add another task to today's flow",
  quickAddSubmit: "Add task",
  quickAddSubmitting: "Adding...",
  quickAddError: "Failed to add task.",
  tasksCounter: (completed, total) => `${completed} of ${total} completed`
};

function TaskItem({
  task,
  onToggle,
  copy
}: {
  task: TodayTask;
  onToggle: (id: string) => void;
  copy: TodayCopy;
}) {
  return (
    <div className={`today-task${task.isCompleted ? " today-task-done" : ""}`}>
      <button
        type="button"
        className="today-task-checkbox"
        onClick={() => onToggle(task.id)}
        aria-label={task.isCompleted ? copy.uncheckTask : copy.checkTask}
      >
        {task.isCompleted ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect
              x="1"
              y="1"
              width="18"
              height="18"
              rx="4"
              fill="var(--accent)"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <path
              d="M6 10l3 3 5-6"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="18" height="18" rx="4" stroke="var(--border)" strokeWidth="2" />
          </svg>
        )}
      </button>
      <div className="today-task-content">
        <span className="today-task-title">{task.title}</span>
        <div className="today-task-meta">
          {task.topicTitle ? <span className="today-task-topic">{task.topicTitle}</span> : null}
          {task.deadline ? (
            <span
              className={`today-task-deadline${
                isOverdue(task.deadline) && !task.isCompleted ? " today-task-deadline-overdue" : ""
              }`}
            >
              {task.deadline}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MaterialCard({ material, copy }: { material: TodayMaterial; copy: TodayCopy }) {
  const typeLabels: Record<string, string> = {
    book: copy.materialBook,
    article: copy.materialArticle,
    course: copy.materialCourse,
    video: copy.materialVideo
  };

  return (
    <div className="today-material">
      <div className="today-material-header">
        <span className="today-material-type">{typeLabels[material.type] ?? material.type}</span>
        <span className="today-material-topic">{material.topicTitle}</span>
      </div>
      <h4 className="today-material-title">{material.title}</h4>
      <div className="today-material-progress">
        <div className="today-material-bar">
          <div className="today-material-bar-fill" style={{ width: `${material.progressPercent}%` }} />
        </div>
        <span className="today-material-count">
          {material.completedAmount}/{material.totalAmount} ({material.progressPercent}%)
        </span>
      </div>
    </div>
  );
}

export function TodayView() {
  const { copy: appCopy } = useUserPreferences();
  const lang =
    appCopy.navigation.ariaPrimary === "Основная навигация" ? "ru" : "en";
  const copy = lang === "ru" ? RU_TODAY_COPY : EN_TODAY_COPY;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskError, setQuickTaskError] = useState<string | null>(null);

  const {
    today,
    isLoading,
    isError,
    toggleTask,
    saveReflection,
    reflectionDraft,
    setReflectionDraft,
    reflectionSaving,
    createTodayTask,
    creatingTask
  } = useTodayViewModel();

  const completedTasksCount = useMemo(
    () => today?.tasks.filter((task) => task.isCompleted).length ?? 0,
    [today]
  );

  async function handleQuickTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTaskTitle.trim();
    if (!title) {
      return;
    }

    setQuickTaskError(null);
    try {
      await createTodayTask(title);
      setQuickTaskTitle("");
    } catch {
      setQuickTaskError(copy.quickAddError);
    }
  }

  if (isLoading) {
    return (
      <div className="today-page">
        <div className="today-loading">{copy.loading}</div>
      </div>
    );
  }

  if (isError || !today) {
    return (
      <div className="today-page">
        <div className="today-error">{copy.error}</div>
      </div>
    );
  }

  const hasSavedReflection = Boolean(today.reflection);
  const draftChanged = reflectionDraft.trim() !== (today.reflection ?? "").trim();

  return (
    <div className="today-page">
      <div className="today-hero">
        <div>
          <p className="today-section-title">{copy.sectionKicker}</p>
          <h1 className="today-header">{copy.header(formatDate(today.date, lang))}</h1>
        </div>

        <div className="today-summary-card">
          <span className="today-summary-label">{copy.focusTasks}</span>
          <strong>{today.tasks.length}</strong>
          <p>{copy.tasksCounter(completedTasksCount, today.tasks.length)}</p>
        </div>
      </div>

      <section className="today-composer">
        <form className="today-quick-add-form" onSubmit={handleQuickTaskSubmit}>
          <label className="today-quick-add-label" htmlFor="today-quick-task">
            {copy.quickAddLabel}
          </label>
          <div className="today-quick-add-row">
            <input
              id="today-quick-task"
              type="text"
              className="input today-quick-add-input"
              placeholder={copy.quickAddPlaceholder}
              value={quickTaskTitle}
              onChange={(event) => setQuickTaskTitle(event.target.value)}
            />
            <button type="submit" className="button button-primary" disabled={creatingTask}>
              {creatingTask ? copy.quickAddSubmitting : copy.quickAddSubmit}
            </button>
          </div>
        </form>
        {quickTaskError ? <p className="today-quick-add-error">{quickTaskError}</p> : null}
      </section>

      <section className="today-section">
        <h2 className="today-section-title">{copy.focusTasks}</h2>
        {today.tasks.length === 0 ? (
          <p className="today-empty">{copy.noTasks}</p>
        ) : (
          <div className="today-task-list">
            {today.tasks.map((task) => (
              <TaskItem key={task.id} task={task} onToggle={toggleTask} copy={copy} />
            ))}
          </div>
        )}
      </section>

      {today.currentMaterial ? (
        <section className="today-section">
          <h2 className="today-section-title">{copy.currentMaterial}</h2>
          <MaterialCard material={today.currentMaterial} copy={copy} />
        </section>
      ) : null}

      <section className="today-section">
        <h2 className="today-section-title">{copy.reflection}</h2>
        {hasSavedReflection && !draftChanged ? (
          <div className="today-reflection-saved">
            <p className="today-reflection-text">{today.reflection}</p>
            <button
              type="button"
              className="today-reflection-edit"
              onClick={() => textareaRef.current?.focus()}
            >
              {copy.reflectionSave}
            </button>
          </div>
        ) : null}

        <div
          className={`today-reflection-editor${
            hasSavedReflection && !draftChanged ? " today-reflection-editor-collapsed" : ""
          }`}
        >
          <textarea
            ref={textareaRef}
            className="today-reflection-textarea"
            placeholder={copy.reflectionPlaceholder}
            value={reflectionDraft}
            onChange={(event) => setReflectionDraft(event.target.value)}
            onBlur={() => {
              if (draftChanged && reflectionDraft.trim()) {
                saveReflection();
              }
            }}
            rows={4}
          />
          {draftChanged && reflectionDraft.trim() ? (
            <button
              type="button"
              className="today-reflection-save-btn"
              onClick={saveReflection}
              disabled={reflectionSaving}
            >
              {reflectionSaving ? copy.reflectionSaving : copy.reflectionSave}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
