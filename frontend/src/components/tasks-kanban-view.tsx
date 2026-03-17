"use client";

import Link from "next/link";
import type { Dispatch, DragEvent, FormEvent, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import {
  formatTaskDueDate,
  getTaskColumnConfig,
  isTaskOverdue,
  type TaskCreateDraft,
  useTasksBoardViewModel
} from "@/components/hooks/use-tasks-board-view-model";
import type { AppLanguage } from "@/lib/ui-copy";
import type {
  TaskBoardDueFilter,
  TaskBoardItem,
  TaskBoardStatus
} from "@/lib/tasks-board-types";

const TASKS_COPY = {
  ru: {
    title: "Мой канбан",
    subtitle: "Отслеживайте задачи по статусам и перемещайте карточки через API-обновления.",
    filterButton: "Фильтр",
    filterModalTitle: "Фильтры задач",
    closeFilterAria: "Закрыть окно фильтров",
    clearFiltersButton: "Сбросить",
    topicFilter: "Тема",
    deadlineFilter: "Дедлайн",
    allTopics: "Все темы",
    dueAll: "Все",
    dueOverdue: "Просроченные",
    dueWeek: "Срок в ближайшие 7 дней",
    loading: "Загрузка доски задач...",
    loadError: "Не удалось загрузить доску задач.",
    retry: "Повторить",
    createTitle: "Добавить задачу",
    createSubtitle: "Новая задача создаётся сразу в колонке «Новая».",
    fieldTitle: "Название",
    fieldDescription: "Описание",
    fieldTopic: "Тема",
    fieldDeadline: "Дедлайн",
    createPlaceholderTitle: "Например: Разобрать flex/grid кейсы",
    createPlaceholderDescription: "Краткое описание задачи (опционально)",
    createButton: "Создать задачу",
    createModalTitle: "Создать задачу",
    closeModalAria: "Закрыть окно создания задачи",
    cancelButton: "Отмена",
    creatingButton: "Создание...",
    noTopicOption: "Без темы",
    titleRequired: "Название задачи обязательно.",
    createFailed: "Не удалось создать задачу.",
    noTasksInColumn: "В этой колонке пока нет задач.",
    noTopic: "Без темы",
    due: "Срок",
    overdue: "Просрочено",
    planned: "Запланировано",
    dragHint: "Перетащите карточку в нужную колонку",
    noDate: "Нет даты",
    deleteTaskAria: "Удалить задачу",
    deleteConfirm: (title: string) => `Удалить задачу «${title}»?`,
    deleteFailed: "Не удалось удалить задачу."
  },
  en: {
    title: "My kanban",
    subtitle: "Track your tasks by status and move cards across columns via API updates.",
    filterButton: "Filter",
    filterModalTitle: "Task filters",
    closeFilterAria: "Close task filters",
    clearFiltersButton: "Reset",
    topicFilter: "Topic",
    deadlineFilter: "Deadline",
    allTopics: "All topics",
    dueAll: "All",
    dueOverdue: "Overdue",
    dueWeek: "Due in 7 days",
    loading: "Loading tasks board...",
    loadError: "Tasks board failed to load.",
    retry: "Retry",
    createTitle: "Add task",
    createSubtitle: "A new task is created directly in the New column.",
    fieldTitle: "Title",
    fieldDescription: "Description",
    fieldTopic: "Topic",
    fieldDeadline: "Deadline",
    createPlaceholderTitle: "For example: Practice flex/grid cases",
    createPlaceholderDescription: "Short task description (optional)",
    createButton: "Create task",
    createModalTitle: "Create task",
    closeModalAria: "Close task creation modal",
    cancelButton: "Cancel",
    creatingButton: "Creating...",
    noTopicOption: "No topic",
    titleRequired: "Task title is required.",
    createFailed: "Task creation failed.",
    noTasksInColumn: "No tasks in this column.",
    noTopic: "No topic",
    due: "Due",
    overdue: "Overdue",
    planned: "Planned",
    dragHint: "Drag this card to another column",
    noDate: "No date",
    deleteTaskAria: "Delete task",
    deleteConfirm: (title: string) => `Delete task "${title}"?`,
    deleteFailed: "Task removal failed."
  }
} as const;

type TasksCopy = (typeof TASKS_COPY)[keyof typeof TASKS_COPY];

interface TaskBoardTopicOption {
  id: string;
  title: string;
}

function TaskDeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 3.75A2.25 2.25 0 0 0 6.75 6H4.5a.75.75 0 0 0 0 1.5h.81l.78 10.19a2.25 2.25 0 0 0 2.24 2.06h7.34a2.25 2.25 0 0 0 2.24-2.06l.78-10.19h.81a.75.75 0 0 0 0-1.5h-2.25A2.25 2.25 0 0 0 15 3.75H9Zm0 1.5h6A.75.75 0 0 1 15.75 6h-7.5A.75.75 0 0 1 9 5.25Zm-.78 2.25h7.56l-.78 10.08a.75.75 0 0 1-.75.67H8.99a.75.75 0 0 1-.75-.67L7.44 7.5Zm2.28 2.25a.75.75 0 0 0-.75.75v5.25a.75.75 0 0 0 1.5 0V10.5a.75.75 0 0 0-.75-.75Zm3 0a.75.75 0 0 0-.75.75v5.25a.75.75 0 0 0 1.5 0V10.5a.75.75 0 0 0-.75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TaskCreateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 4.5a.75.75 0 0 1 .75.75v6h6a.75.75 0 0 1 0 1.5h-6v6a.75.75 0 0 1-1.5 0v-6h-6a.75.75 0 0 1 0-1.5h6v-6A.75.75 0 0 1 12 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TaskFilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.5 6.75A.75.75 0 0 1 5.25 6h13.5a.75.75 0 0 1 .53 1.28l-4.78 4.78V17.4a.75.75 0 0 1-.4.66l-3 1.58a.75.75 0 0 1-1.1-.66v-6.92L4.72 7.28a.75.75 0 0 1-.22-.53Zm2.56.75 4.5 4.5a.75.75 0 0 1 .22.53v5.2l1.5-.79v-4.4a.75.75 0 0 1 .22-.53l4.5-4.5H7.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TasksBoardHeader({
  copy,
  onCreateClick,
  onFilterClick,
  isFilterActive
}: {
  copy: TasksCopy;
  onCreateClick: (triggerElement: HTMLElement) => void;
  onFilterClick: (triggerElement: HTMLElement) => void;
  isFilterActive: boolean;
}) {
  return (
    <header className="tasks-board-header panel">
      <div>
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </div>

      <div className="tasks-board-controls">
        <button
          type="button"
          className={`button tasks-action-button tasks-filter-button ${
            isFilterActive ? "tasks-filter-button-active" : ""
          }`}
          onClick={(event) => onFilterClick(event.currentTarget)}
          aria-haspopup="dialog"
        >
          <TaskFilterIcon />
          {copy.filterButton}
        </button>

        <button
          type="button"
          className="button button-primary tasks-action-button"
          onClick={(event) => onCreateClick(event.currentTarget)}
        >
          <TaskCreateIcon />
          {copy.createButton}
        </button>
      </div>
    </header>
  );
}

function TasksFiltersDrawer({
  copy,
  topics,
  topicId,
  due,
  onTopicChange,
  onDueChange,
  onReset,
  onClose,
  titleId
}: {
  copy: TasksCopy;
  topics: TaskBoardTopicOption[];
  topicId: string;
  due: TaskBoardDueFilter;
  onTopicChange: (topicId: string) => void;
  onDueChange: (due: TaskBoardDueFilter) => void;
  onReset: () => void;
  onClose: () => void;
  titleId: string;
}) {
  return (
    <div className="roadmap-modal-overlay tasks-filter-overlay" role="presentation" onClick={onClose}>
      <section
        className="tasks-filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="tasks-filter-drawer-header">
          <h4 id={titleId}>{copy.filterModalTitle}</h4>
          <button
            type="button"
            className="roadmap-modal-close"
            aria-label={copy.closeFilterAria}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="tasks-filter-drawer-body">
          <label className="tasks-filter-item">
            <span>{copy.topicFilter}</span>
            <select
              className="input tasks-filter-select"
              value={topicId}
              onChange={(event) => onTopicChange(event.target.value)}
            >
              <option value="">{copy.allTopics}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </label>

          <label className="tasks-filter-item">
            <span>{copy.deadlineFilter}</span>
            <select
              className="input tasks-filter-select"
              value={due}
              onChange={(event) => onDueChange(event.target.value as TaskBoardDueFilter)}
            >
              <option value="all">{copy.dueAll}</option>
              <option value="overdue">{copy.dueOverdue}</option>
              <option value="week">{copy.dueWeek}</option>
            </select>
          </label>
        </div>

        <div className="tasks-filter-drawer-actions">
          <button type="button" className="button button-outline" onClick={onReset}>
            {copy.clearFiltersButton}
          </button>
          <button type="button" className="button button-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </section>
    </div>
  );
}

function TasksBoardColumn({
  copy,
  language,
  column,
  tasks,
  updatingTaskId,
  draggedTaskId,
  isDropTarget,
  onCardDragStart,
  onCardDragEnd,
  onColumnDragEnter,
  onColumnDragLeave,
  onColumnDrop,
  onDelete
}: {
  copy: TasksCopy;
  language: AppLanguage;
  column: {
    status: TaskBoardStatus;
    label: string;
    dotClass: string;
  };
  tasks: TaskBoardItem[];
  updatingTaskId: string | null;
  draggedTaskId: string | null;
  isDropTarget: boolean;
  onCardDragStart: (event: DragEvent<HTMLLIElement>, taskId: string) => void;
  onCardDragEnd: () => void;
  onColumnDragEnter: (status: TaskBoardStatus) => void;
  onColumnDragLeave: (status: TaskBoardStatus) => void;
  onColumnDrop: (event: DragEvent<HTMLDivElement>, status: TaskBoardStatus) => void;
  onDelete: (task: TaskBoardItem) => void;
}) {
  return (
    <div
      className={`tasks-column ${isDropTarget ? "tasks-column-drop-target" : ""}`}
      onDragOver={(event) => {
        if (!draggedTaskId) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(event) => {
        if (!draggedTaskId) {
          return;
        }
        event.preventDefault();
        onColumnDragEnter(column.status);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) {
          return;
        }
        onColumnDragLeave(column.status);
      }}
      onDrop={(event) => onColumnDrop(event, column.status)}
    >
      <header className="tasks-column-header">
        <div className="tasks-column-title-wrap">
          <span className={`tasks-column-dot ${column.dotClass}`} />
          <h3>{column.label}</h3>
        </div>
        <span className="tasks-column-count">{tasks.length}</span>
      </header>

      <ul className="tasks-column-list">
        {tasks.length === 0 ? (
          <li className="tasks-empty-card">{copy.noTasksInColumn}</li>
        ) : (
          tasks.map((task) => (
            <li
              key={task.id}
              className={`tasks-card ${draggedTaskId === task.id ? "tasks-card-dragging" : ""}`}
              draggable={updatingTaskId !== task.id}
              onDragStart={(event) => onCardDragStart(event, task.id)}
              onDragEnd={onCardDragEnd}
            >
              <div className="tasks-card-head">
                {task.topicId && task.topicTitle ? (
                  <Link href={`/topics?topicId=${encodeURIComponent(task.topicId)}`}>
                    {task.topicTitle}
                  </Link>
                ) : (
                  <span>{copy.noTopic}</span>
                )}
                <button
                  type="button"
                  className="tasks-delete-button"
                  aria-label={`${copy.deleteTaskAria}: ${task.title}`}
                  title={copy.deleteTaskAria}
                  disabled={updatingTaskId === task.id}
                  onClick={() => onDelete(task)}
                >
                  <TaskDeleteIcon />
                </button>
              </div>

              <h4>{task.title}</h4>
              <p>{task.description}</p>

              <div className="tasks-card-meta">
                <span>
                  {copy.due}: {formatTaskDueDate(task.dueAt, language, copy.noDate)}
                </span>
                {isTaskOverdue(task) ? (
                  <span className="dashboard-badge dashboard-badge-overdue">{copy.overdue}</span>
                ) : (
                  <span className="dashboard-badge">{copy.planned}</span>
                )}
              </div>

              <p className="tasks-card-drag-hint">{copy.dragHint}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function TasksCreatePanel({
  copy,
  topics,
  createDraft,
  setCreateDraft,
  isCreating,
  onSubmit,
  includePanelStyles = true
}: {
  copy: TasksCopy;
  topics: TaskBoardTopicOption[];
  createDraft: TaskCreateDraft;
  setCreateDraft: Dispatch<SetStateAction<TaskCreateDraft>>;
  isCreating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  includePanelStyles?: boolean;
}) {
  const rootClassName = includePanelStyles ? "panel tasks-create-panel" : "tasks-create-panel";

  return (
    <section className={rootClassName}>
      <header>
        <h3>{copy.createTitle}</h3>
        <p>{copy.createSubtitle}</p>
      </header>

      <form className="tasks-create-form" onSubmit={onSubmit}>
        <label className="tasks-create-field tasks-create-field-title">
          <span>{copy.fieldTitle}</span>
          <input
            type="text"
            className="input"
            value={createDraft.title}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                title: event.target.value
              }))
            }
            placeholder={copy.createPlaceholderTitle}
          />
        </label>

        <label className="tasks-create-field">
          <span>{copy.fieldTopic}</span>
          <select
            className="input"
            value={createDraft.topicId}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                topicId: event.target.value
              }))
            }
          >
            <option value="">{copy.noTopicOption}</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </label>

        <label className="tasks-create-field">
          <span>{copy.fieldDeadline}</span>
          <input
            type="date"
            className="input"
            value={createDraft.deadline}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                deadline: event.target.value
              }))
            }
          />
        </label>

        <label className="tasks-create-field tasks-create-field-description">
          <span>{copy.fieldDescription}</span>
          <textarea
            value={createDraft.description}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                description: event.target.value
              }))
            }
            placeholder={copy.createPlaceholderDescription}
          />
        </label>

        <button type="submit" className="button button-primary" disabled={isCreating}>
          {isCreating ? copy.creatingButton : copy.createButton}
        </button>
      </form>
    </section>
  );
}

export function TasksKanbanView() {
  const { language } = useUserPreferences();
  const copy = TASKS_COPY[language];
  const columnConfig = useMemo(() => getTaskColumnConfig(language), [language]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskBoardStatus | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const createModalTitleId = "tasks-create-modal-title";
  const filterModalTitleId = "tasks-filter-modal-title";
  const createModalTriggerRef = useRef<HTMLElement | null>(null);
  const filterDrawerTriggerRef = useRef<HTMLElement | null>(null);
  const {
    filters,
    setFilters,
    createDraft,
    setCreateDraft,
    state,
    reload,
    updatingTaskId,
    isCreating,
    mutationError,
    clearMutationError,
    groupedTasks,
    handleCreate,
    handleStatusChange,
    handleDelete
  } = useTasksBoardViewModel(copy);
  const taskStatusById = useMemo(() => {
    const statusMap = new Map<string, TaskBoardStatus>();
    for (const task of state.data?.tasks ?? []) {
      statusMap.set(task.id, task.status);
    }
    return statusMap;
  }, [state.data?.tasks]);

  useEffect(() => {
    if (!isCreateModalOpen && !isFilterDrawerOpen) {
      return;
    }

    function handleEscClose(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isCreateModalOpen && !isCreating) {
        clearMutationError();
        setIsCreateModalOpen(false);
        createModalTriggerRef.current?.focus();
        createModalTriggerRef.current = null;
        return;
      }

      if (isFilterDrawerOpen) {
        setIsFilterDrawerOpen(false);
        filterDrawerTriggerRef.current?.focus();
        filterDrawerTriggerRef.current = null;
      }
    }

    document.addEventListener("keydown", handleEscClose);
    return () => document.removeEventListener("keydown", handleEscClose);
  }, [isCreateModalOpen, isFilterDrawerOpen, isCreating, clearMutationError]);

  function handleCardDragStart(event: DragEvent<HTMLLIElement>, taskId: string) {
    if (updatingTaskId === taskId) {
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  }

  function handleCardDragEnd() {
    setDraggedTaskId(null);
    setDragOverStatus(null);
  }

  function handleColumnDrop(event: DragEvent<HTMLDivElement>, status: TaskBoardStatus) {
    event.preventDefault();

    const taskId = draggedTaskId ?? event.dataTransfer.getData("text/plain");
    const previousStatus = taskId ? taskStatusById.get(taskId) : null;

    setDraggedTaskId(null);
    setDragOverStatus(null);

    if (!taskId || !previousStatus || previousStatus === status || updatingTaskId === taskId) {
      return;
    }

    void handleStatusChange(taskId, status);
  }

  function openCreateModal(triggerElement: HTMLElement) {
    clearMutationError();
    createModalTriggerRef.current = triggerElement;
    setIsCreateModalOpen(true);
  }

  function openFilterDrawer(triggerElement: HTMLElement) {
    filterDrawerTriggerRef.current = triggerElement;
    setIsFilterDrawerOpen(true);
  }

  function closeFilterDrawer() {
    setIsFilterDrawerOpen(false);
    filterDrawerTriggerRef.current?.focus();
    filterDrawerTriggerRef.current = null;
  }

  function closeCreateModal() {
    if (isCreating) {
      return;
    }
    clearMutationError();
    setIsCreateModalOpen(false);
    createModalTriggerRef.current?.focus();
    createModalTriggerRef.current = null;
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    const created = await handleCreate(event);
    if (!created) {
      return;
    }

    clearMutationError();
    setIsCreateModalOpen(false);
    createModalTriggerRef.current?.focus();
    createModalTriggerRef.current = null;
  }

  return (
    <section className="tasks-board-view">
      <TasksBoardHeader
        copy={copy}
        onCreateClick={openCreateModal}
        onFilterClick={openFilterDrawer}
        isFilterActive={Boolean(filters.topicId) || filters.due !== "all"}
      />

      {isFilterDrawerOpen ? (
        <TasksFiltersDrawer
          copy={copy}
          topics={state.data?.topics ?? []}
          topicId={filters.topicId}
          due={filters.due}
          onTopicChange={(topicId) =>
            setFilters((current) => ({
              ...current,
              topicId
            }))
          }
          onDueChange={(due) =>
            setFilters((current) => ({
              ...current,
              due
            }))
          }
          onReset={() =>
            setFilters((current) => ({
              ...current,
              topicId: "",
              due: "all"
            }))
          }
          onClose={closeFilterDrawer}
          titleId={filterModalTitleId}
        />
      ) : null}

      {isCreateModalOpen ? (
        <div className="roadmap-modal-overlay" role="presentation" onClick={closeCreateModal}>
          <section
            className="roadmap-modal tasks-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={createModalTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="roadmap-modal-header">
              <h4 id={createModalTitleId}>{copy.createModalTitle}</h4>
              <button
                type="button"
                className="roadmap-modal-close"
                aria-label={copy.closeModalAria}
                onClick={closeCreateModal}
              >
                ×
              </button>
            </div>

            <TasksCreatePanel
              copy={copy}
              topics={state.data?.topics ?? []}
              createDraft={createDraft}
              setCreateDraft={setCreateDraft}
              isCreating={isCreating}
              onSubmit={handleCreateSubmit}
              includePanelStyles={false}
            />

            {mutationError ? (
              <div className="dashboard-error">
                <p>{mutationError}</p>
              </div>
            ) : null}

            <div className="roadmap-modal-actions">
              <button type="button" className="button button-outline" onClick={closeCreateModal}>
                {copy.cancelButton}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {mutationError && !isCreateModalOpen ? (
        <div className="dashboard-error">
          <p>{mutationError}</p>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <section className="panel tasks-loading-panel">
          <p className="tasks-loading-title">{copy.loading}</p>
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="panel">
          <div className="dashboard-error">
            <p>{state.errorMessage ?? copy.loadError}</p>
            <button type="button" className="button button-outline dashboard-retry" onClick={reload}>
              {copy.retry}
            </button>
          </div>
        </section>
      ) : null}

      {state.status === "success" ? (
        <section className="tasks-board-columns">
          {columnConfig.map((column) => (
            <TasksBoardColumn
              key={column.status}
              copy={copy}
              language={language}
              column={column}
              tasks={groupedTasks[column.status]}
              updatingTaskId={updatingTaskId}
              draggedTaskId={draggedTaskId}
              isDropTarget={Boolean(draggedTaskId) && dragOverStatus === column.status}
              onCardDragStart={handleCardDragStart}
              onCardDragEnd={handleCardDragEnd}
              onColumnDragEnter={setDragOverStatus}
              onColumnDragLeave={(status) => {
                if (dragOverStatus === status) {
                  setDragOverStatus(null);
                }
              }}
              onColumnDrop={handleColumnDrop}
              onDelete={(task) => {
                if (!window.confirm(copy.deleteConfirm(task.title))) {
                  return;
                }
                void handleDelete(task.id);
              }}
            />
          ))}
        </section>
      ) : null}
    </section>
  );
}
