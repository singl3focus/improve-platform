"use client";

import Link from "next/link";
import type { Dispatch, DragEvent, FormEvent, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Pencil, Plus, Trash2 } from "lucide-react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import {
  formatTaskDueDate,
  getTaskColumnConfig,
  isTaskOverdue,
  type TaskCreateDraft,
  useTasksBoardViewModel
} from "@features/tasks/hooks/use-tasks-board-view-model";
import type { AppLanguage } from "@shared/i18n/ui-copy";
import type {
  TaskBoardDueFilter,
  TaskBoardItem,
  TaskBoardStatus
} from "@features/tasks/types";

const TASKS_COPY = {
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
  fieldTitle: "Название",
  fieldDescription: "Описание",
  fieldTopic: "Тема",
  fieldDeadline: "Дедлайн",
  createPlaceholderTitle: "Например: Разобрать flex/grid кейсы",
  createPlaceholderDescription: "Краткое описание задачи (опционально)",
  createButton: "Создать задачу",
  createModalTitle: "Создать задачу",
  closeModalAria: "Закрыть окно создания задачи",
  creatingButton: "Создание...",
  noTopicOption: "Без темы",
  titleRequired: "Название задачи обязательно.",
  createFailed: "Не удалось создать задачу.",
  updateFailed: "Не удалось обновить задачу.",
  noTasksInColumn: "В этой колонке пока нет задач.",
  noTopic: "Без темы",
  due: "Срок",
  overdue: "Просрочено",
  planned: "Запланировано",
  editTaskAria: "Редактировать задачу",
  editModalTitle: "Редактировать задачу",
  closeEditModalAria: "Закрыть окно редактирования задачи",
  saveButton: "Сохранить",
  savingButton: "Сохранение...",
  noDate: "Нет даты",
  deleteTaskAria: "Удалить задачу",
  deleteConfirm: (title: string) => `Удалить задачу «${title}»?`,
  deleteFailed: "Не удалось удалить задачу."
} as const;

type TasksCopy = typeof TASKS_COPY;

interface TaskBoardTopicOption {
  id: string;
  title: string;
}

function TaskDeleteIcon() {
  return <Trash2 size={16} strokeWidth={2} aria-hidden="true" focusable="false" />;
}

function TaskEditIcon() {
  return <Pencil size={16} strokeWidth={2} aria-hidden="true" focusable="false" />;
}

function TaskCreateIcon() {
  return <Plus size={16} strokeWidth={2} aria-hidden="true" focusable="false" />;
}

function TaskFilterIcon() {
  return <Filter size={16} strokeWidth={2} aria-hidden="true" focusable="false" />;
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
  onEdit,
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
  onEdit: (task: TaskBoardItem, triggerElement: HTMLElement) => void;
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
                <div className="tasks-card-actions">
                  <button
                    type="button"
                    className="tasks-edit-button"
                    aria-label={`${copy.editTaskAria}: ${task.title}`}
                    title={copy.editTaskAria}
                    disabled={updatingTaskId === task.id}
                    onClick={(event) => onEdit(task, event.currentTarget)}
                  >
                    <TaskEditIcon />
                  </button>
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

function TasksEditPanel({
  copy,
  topics,
  editDraft,
  setEditDraft,
  isSaving,
  onSubmit
}: {
  copy: TasksCopy;
  topics: TaskBoardTopicOption[];
  editDraft: TaskCreateDraft;
  setEditDraft: Dispatch<SetStateAction<TaskCreateDraft>>;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="tasks-create-panel">
      <form className="tasks-create-form" onSubmit={onSubmit}>
        <label className="tasks-create-field tasks-create-field-title">
          <span>{copy.fieldTitle}</span>
          <input
            type="text"
            className="input"
            value={editDraft.title}
            onChange={(event) =>
              setEditDraft((current) => ({
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
            value={editDraft.topicId}
            onChange={(event) =>
              setEditDraft((current) => ({
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
            value={editDraft.deadline}
            onChange={(event) =>
              setEditDraft((current) => ({
                ...current,
                deadline: event.target.value
              }))
            }
          />
        </label>

        <label className="tasks-create-field tasks-create-field-description">
          <span>{copy.fieldDescription}</span>
          <textarea
            value={editDraft.description}
            onChange={(event) =>
              setEditDraft((current) => ({
                ...current,
                description: event.target.value
              }))
            }
            placeholder={copy.createPlaceholderDescription}
          />
        </label>

        <button type="submit" className="button button-primary" disabled={isSaving}>
          {isSaving ? copy.savingButton : copy.saveButton}
        </button>
      </form>
    </section>
  );
}

export function TasksKanbanView() {
  const { language } = useUserPreferences();
  const copy = TASKS_COPY;
  const columnConfig = useMemo(() => getTaskColumnConfig(language), [language]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskBoardStatus | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskCreateDraft>({
    title: "",
    description: "",
    topicId: "",
    deadline: ""
  });
  const createModalTitleId = "tasks-create-modal-title";
  const editModalTitleId = "tasks-edit-modal-title";
  const filterModalTitleId = "tasks-filter-modal-title";
  const createModalTriggerRef = useRef<HTMLElement | null>(null);
  const editModalTriggerRef = useRef<HTMLElement | null>(null);
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
    handleUpdate,
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
    if (!isCreateModalOpen && !isEditModalOpen && !isFilterDrawerOpen) {
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

      if (isEditModalOpen && (!editingTaskId || updatingTaskId !== editingTaskId)) {
        clearMutationError();
        setIsEditModalOpen(false);
        setEditingTaskId(null);
        editModalTriggerRef.current?.focus();
        editModalTriggerRef.current = null;
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
  }, [
    isCreateModalOpen,
    isEditModalOpen,
    isFilterDrawerOpen,
    isCreating,
    updatingTaskId,
    editingTaskId,
    clearMutationError
  ]);

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

  function openEditModal(task: TaskBoardItem, triggerElement: HTMLElement) {
    clearMutationError();
    editModalTriggerRef.current = triggerElement;
    setEditingTaskId(task.id);
    setEditDraft({
      title: task.title,
      description: task.description,
      topicId: task.topicId ?? "",
      deadline: task.dueAt
    });
    setIsEditModalOpen(true);
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

  function closeEditModal() {
    if (editingTaskId && updatingTaskId === editingTaskId) {
      return;
    }
    clearMutationError();
    setIsEditModalOpen(false);
    setEditingTaskId(null);
    editModalTriggerRef.current?.focus();
    editModalTriggerRef.current = null;
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

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTaskId) {
      return;
    }

    const updated = await handleUpdate(editingTaskId, editDraft);
    if (!updated) {
      return;
    }

    clearMutationError();
    setIsEditModalOpen(false);
    setEditingTaskId(null);
    editModalTriggerRef.current?.focus();
    editModalTriggerRef.current = null;
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

          </section>
        </div>
      ) : null}

      {isEditModalOpen ? (
        <div className="roadmap-modal-overlay" role="presentation" onClick={closeEditModal}>
          <section
            className="roadmap-modal tasks-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={editModalTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="roadmap-modal-header">
              <h4 id={editModalTitleId}>{copy.editModalTitle}</h4>
              <button
                type="button"
                className="roadmap-modal-close"
                aria-label={copy.closeEditModalAria}
                onClick={closeEditModal}
              >
                ×
              </button>
            </div>

            <TasksEditPanel
              copy={copy}
              topics={state.data?.topics ?? []}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              isSaving={Boolean(editingTaskId) && updatingTaskId === editingTaskId}
              onSubmit={handleEditSubmit}
            />

            {mutationError ? (
              <div className="dashboard-error">
                <p>{mutationError}</p>
              </div>
            ) : null}

          </section>
        </div>
      ) : null}

      {mutationError && !isCreateModalOpen && !isEditModalOpen ? (
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
              onEdit={openEditModal}
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
