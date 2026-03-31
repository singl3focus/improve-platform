"use client";

import Link from "next/link";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import {
  type MaterialDraft,
  useMaterialsLibraryViewModel
} from "@features/materials/hooks/use-materials-library-view-model";
import type { LibraryMaterial, MaterialType, MaterialUnit } from "@features/materials/types";

type MaterialsCopy = {
  title: string;
  subtitle: string;
  search: string;
  topic: string;
  allTopics: string;
  searchPlaceholder: string;
  fieldTitle: string;
  fieldDescription: string;
  fieldType: string;
  fieldUnit: string;
  fieldTotalAmount: string;
  fieldCompletedAmount: string;
  fieldPosition: string;
  fieldUrl: string;
  fieldTopic: string;
  typeBook: string;
  typeArticle: string;
  typeCourse: string;
  typeVideo: string;
  unitPages: string;
  unitLessons: string;
  unitHours: string;
  createPlaceholderTitle: string;
  createPlaceholderDescription: string;
  createPlaceholderUrl: string;
  noTopicsAvailable: string;
  createButton: string;
  createModalTitle: string;
  closeModalAria: string;
  creatingButton: string;
  topicRequired: string;
  titleDescriptionRequired: string;
  amountInvalid: string;
  createFailed: string;
  updateFailed: string;
  deleteFailed: string;
  loading: string;
  loadFailed: string;
  retry: string;
  progress: string;
  edit: string;
  delete: string;
  save: string;
  cancel: string;
  empty: string;
  summaryTitle: string;
  summaryTotal: string;
  summaryTracked: string;
  summaryAverage: string;
  resultsLabel: (count: number) => string;
};

const COPY: Record<"ru" | "en", MaterialsCopy> = {
  ru: {
    title: "Библиотека материалов",
    subtitle: "Поиск, фильтрация и аккуратное ведение учебных ресурсов по темам.",
    search: "Поиск",
    topic: "Тема",
    allTopics: "Все темы",
    searchPlaceholder: "Название, описание или тема",
    fieldTitle: "Название",
    fieldDescription: "Описание",
    fieldType: "Тип",
    fieldUnit: "Единица",
    fieldTotalAmount: "Полный объём",
    fieldCompletedAmount: "Пройдено",
    fieldPosition: "Позиция",
    fieldUrl: "Ссылка",
    fieldTopic: "Тема",
    typeBook: "Книга",
    typeArticle: "Статья",
    typeCourse: "Курс",
    typeVideo: "Видео",
    unitPages: "страницы",
    unitLessons: "уроки",
    unitHours: "часы",
    createPlaceholderTitle: "Название материала",
    createPlaceholderDescription: "Короткое описание материала",
    createPlaceholderUrl: "https://...",
    noTopicsAvailable: "Нет доступных тем",
    createButton: "Добавить материал",
    createModalTitle: "Новый материал",
    closeModalAria: "Закрыть окно создания материала",
    creatingButton: "Создание...",
    topicRequired: "Для материала нужна тема.",
    titleDescriptionRequired: "Название обязательно.",
    amountInvalid: "Пройденный объём не может быть больше полного.",
    createFailed: "Не удалось создать материал.",
    updateFailed: "Не удалось обновить материал.",
    deleteFailed: "Не удалось удалить материал.",
    loading: "Загрузка библиотеки...",
    loadFailed: "Не удалось загрузить библиотеку материалов.",
    retry: "Повторить",
    progress: "Прогресс",
    edit: "Редактировать",
    delete: "Удалить",
    save: "Сохранить",
    cancel: "Отмена",
    empty: "По текущим фильтрам материалы не найдены. Измените фильтр или добавьте новый ресурс.",
    summaryTitle: "Сводка библиотеки",
    summaryTotal: "Всего материалов",
    summaryTracked: "С прогрессом",
    summaryAverage: "Средний прогресс",
    resultsLabel: (count) => `${count} материалов`
  },
  en: {
    title: "Materials library",
    subtitle: "Search, filter, and maintain your learning resources with a calmer operational flow.",
    search: "Search",
    topic: "Topic",
    allTopics: "All topics",
    searchPlaceholder: "Title, description, or topic",
    fieldTitle: "Title",
    fieldDescription: "Description",
    fieldType: "Type",
    fieldUnit: "Unit",
    fieldTotalAmount: "Total amount",
    fieldCompletedAmount: "Completed",
    fieldPosition: "Position",
    fieldUrl: "URL",
    fieldTopic: "Topic",
    typeBook: "Book",
    typeArticle: "Article",
    typeCourse: "Course",
    typeVideo: "Video",
    unitPages: "pages",
    unitLessons: "lessons",
    unitHours: "hours",
    createPlaceholderTitle: "Material title",
    createPlaceholderDescription: "Short material description",
    createPlaceholderUrl: "https://...",
    noTopicsAvailable: "No topics available",
    createButton: "Add material",
    createModalTitle: "New material",
    closeModalAria: "Close material creation dialog",
    creatingButton: "Creating...",
    topicRequired: "A topic is required for a material.",
    titleDescriptionRequired: "Title is required.",
    amountInvalid: "Completed amount cannot exceed total amount.",
    createFailed: "Failed to create material.",
    updateFailed: "Failed to update material.",
    deleteFailed: "Failed to delete material.",
    loading: "Loading library...",
    loadFailed: "Failed to load materials library.",
    retry: "Retry",
    progress: "Progress",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    empty: "No materials match the current filters. Adjust the filters or add a new resource.",
    summaryTitle: "Library pulse",
    summaryTotal: "Total materials",
    summaryTracked: "With progress",
    summaryAverage: "Average progress",
    resultsLabel: (count) => `${count} materials`
  }
};

const MATERIAL_TYPE_OPTIONS: MaterialType[] = ["book", "article", "course", "video"];

interface TopicOption {
  id: string;
  title: string;
}

function getMaterialTypeLabel(copy: MaterialsCopy, type: MaterialType): string {
  if (type === "book") return copy.typeBook;
  if (type === "article") return copy.typeArticle;
  if (type === "course") return copy.typeCourse;
  return copy.typeVideo;
}

function getMaterialUnitLabel(copy: MaterialsCopy, unit: MaterialUnit): string {
  if (unit === "hours") return copy.unitHours;
  if (unit === "lessons") return copy.unitLessons;
  return copy.unitPages;
}

function MaterialsSummary({
  copy,
  materials
}: {
  copy: MaterialsCopy;
  materials: LibraryMaterial[];
}) {
  const total = materials.length;
  const tracked = materials.filter((material) => material.completedAmount > 0).length;
  const average = total
    ? Math.round(
        materials.reduce((sum, material) => sum + material.progressPercent, 0) / total
      )
    : 0;

  return (
    <aside className="materials-summary-card">
      <p className="materials-summary-kicker">{copy.summaryTitle}</p>
      <div className="materials-summary-metric">
        <span>{copy.summaryTotal}</span>
        <strong>{total}</strong>
      </div>
      <div className="materials-summary-metric">
        <span>{copy.summaryTracked}</span>
        <strong>{tracked}</strong>
      </div>
      <div className="materials-summary-metric">
        <span>{copy.summaryAverage}</span>
        <strong>{average}%</strong>
      </div>
    </aside>
  );
}

function MaterialsLibraryHeader({
  copy,
  query,
  topicId,
  topics,
  resultsCount,
  onQueryChange,
  onTopicChange,
  onCreateClick,
  materials
}: {
  copy: MaterialsCopy;
  query: string;
  topicId: string;
  topics: TopicOption[];
  resultsCount: number;
  onQueryChange: (query: string) => void;
  onTopicChange: (topicId: string) => void;
  onCreateClick: (triggerElement: HTMLElement) => void;
  materials: LibraryMaterial[];
}) {
  return (
    <header className="materials-library-header">
      <div className="materials-library-intro">
        <div>
          <p className="materials-summary-kicker">{copy.summaryTitle}</p>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <MaterialsSummary copy={copy} materials={materials} />
      </div>

      <div className="panel materials-library-controls-panel">
        <div className="materials-library-controls">
          <label className="materials-filter-item materials-filter-item-search">
            <span>{copy.search}</span>
            <input
              type="search"
              className="input materials-filter-input"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={copy.searchPlaceholder}
            />
          </label>

          <label className="materials-filter-item materials-filter-item-topic">
            <span>{copy.topic}</span>
            <select
              className="input materials-filter-select"
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

          <div className="materials-controls-meta">
            <span className="materials-results-count">{copy.resultsLabel(resultsCount)}</span>
            <button
              type="button"
              className="button button-primary materials-create-trigger"
              onClick={(event) => onCreateClick(event.currentTarget)}
            >
              {copy.createButton}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function MaterialsCreatePanel({
  copy,
  createDraft,
  setCreateDraft,
  availableTopics,
  isCreating,
  onSubmit,
  includePanelStyles = true,
  error
}: {
  copy: MaterialsCopy;
  createDraft: MaterialDraft;
  setCreateDraft: Dispatch<SetStateAction<MaterialDraft>>;
  availableTopics: TopicOption[];
  isCreating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  includePanelStyles?: boolean;
  error?: string | null;
}) {
  const rootClassName = includePanelStyles ? "panel materials-create-panel" : "materials-create-panel";

  return (
    <section className={rootClassName}>
      <form className="materials-create-form" onSubmit={onSubmit}>
        <label className="materials-form-field materials-form-field-title">
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

        <label className="materials-form-field">
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
            {availableTopics.length === 0 ? (
              <option value="">{copy.noTopicsAvailable}</option>
            ) : (
              availableTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="materials-form-field">
          <span>{copy.fieldType}</span>
          <select
            className="input"
            value={createDraft.type}
            onChange={(event) => {
              const nextType = event.target.value as MaterialType;
              setCreateDraft((current) => ({
                ...current,
                type: nextType,
                unit: nextType === "video" ? "hours" : nextType === "course" ? "lessons" : "pages"
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

        <label className="materials-form-field">
          <span>{copy.fieldUnit}</span>
          <input
            type="text"
            className="input"
            value={getMaterialUnitLabel(copy, createDraft.unit as MaterialUnit)}
            readOnly
            disabled
          />
        </label>

        <label className="materials-form-field">
          <span>{copy.fieldTotalAmount}</span>
          <input
            type="number"
            min={0}
            className="input"
            value={createDraft.totalAmount}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                totalAmount: event.target.value
              }))
            }
          />
        </label>

        <label className="materials-form-field">
          <span>{copy.fieldCompletedAmount}</span>
          <input
            type="number"
            min={0}
            className="input"
            value={createDraft.completedAmount}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                completedAmount: event.target.value
              }))
            }
          />
        </label>

        <label className="materials-form-field">
          <span>{copy.fieldPosition}</span>
          <input
            type="number"
            min={1}
            className="input"
            value={createDraft.position}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                position: event.target.value
              }))
            }
          />
        </label>

        <label className="materials-form-field materials-form-field-description">
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

        <label className="materials-form-field" style={{ gridColumn: "1 / -1" }}>
          <span>{copy.fieldUrl}</span>
          <input
            type="url"
            className="input"
            value={createDraft.url}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                url: event.target.value
              }))
            }
            placeholder={copy.createPlaceholderUrl}
          />
        </label>

        {error ? (
          <div className="dashboard-error" style={{ gridColumn: "1 / -1" }}>
            <p>{error}</p>
          </div>
        ) : null}

        <button type="submit" className="button button-primary" disabled={isCreating}>
          {isCreating ? copy.creatingButton : copy.createButton}
        </button>
      </form>
    </section>
  );
}

function MaterialsCard({
  copy,
  material,
  availableTopics,
  editingId,
  editDraft,
  setEditDraft,
  updatingMaterialId,
  onEditStart,
  onDelete,
  computeProgressPercent,
  onEditSubmit,
  onCancelEdit
}: {
  copy: MaterialsCopy;
  material: LibraryMaterial;
  availableTopics: TopicOption[];
  editingId: string | null;
  editDraft: MaterialDraft | null;
  setEditDraft: Dispatch<SetStateAction<MaterialDraft | null>>;
  updatingMaterialId: string | null;
  onEditStart: (material: LibraryMaterial) => void;
  onDelete: (materialId: string) => void;
  computeProgressPercent: (totalAmount: number, completedAmount: number) => number;
  onEditSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
}) {
  const computedProgress = computeProgressPercent(material.totalAmount, material.completedAmount);

  return (
    <li className="materials-card">
      <div className="materials-card-head">
        <div className="materials-card-topic-row">
          <span className="topic-material-position">#{material.position}</span>
          <Link
            className="materials-card-topic-link"
            href={`/topics?topicId=${encodeURIComponent(material.topicId)}`}
          >
            {material.topicTitle}
          </Link>
        </div>
        <div className="materials-card-meta-head">
          <span className="materials-type-badge">{getMaterialTypeLabel(copy, material.type)}</span>
          <span className="materials-measure-badge">
            {material.completedAmount}/{material.totalAmount}{" "}
            {getMaterialUnitLabel(copy, material.unit)}
          </span>
        </div>
      </div>

      <div className="materials-card-body">
        <div>
          <h3>{material.title}</h3>
          <p>{material.description}</p>
          {material.url ? (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="materials-url-link"
            >
              {material.url}
            </a>
          ) : null}
        </div>

        <div className="materials-card-side">
          <div className="materials-card-progress-head">
            <span>{copy.progress}</span>
            <strong>{computedProgress}%</strong>
          </div>
          <div className="roadmap-progress-track">
            <span className="roadmap-progress-fill" style={{ width: `${computedProgress}%` }} />
          </div>

          <div className="materials-card-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => onEditStart(material)}
              disabled={updatingMaterialId === material.id}
            >
              {copy.edit}
            </button>
            <button
              type="button"
              className="button button-outline materials-delete-button"
              onClick={() => onDelete(material.id)}
              disabled={updatingMaterialId === material.id}
            >
              {copy.delete}
            </button>
          </div>
        </div>
      </div>

      {editingId === material.id && editDraft ? (
        <form className="materials-edit-form" onSubmit={onEditSubmit}>
          <label className="materials-form-field materials-form-field-title">
            <span>{copy.fieldTitle}</span>
            <input
              type="text"
              className="input"
              value={editDraft.title}
              onChange={(event) =>
                setEditDraft((current) =>
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

          <label className="materials-form-field">
            <span>{copy.fieldTopic}</span>
            <select
              className="input"
              value={editDraft.topicId}
              onChange={(event) =>
                setEditDraft((current) =>
                  current
                    ? {
                        ...current,
                        topicId: event.target.value
                      }
                    : current
                )
              }
            >
              {availableTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </label>

          <label className="materials-form-field">
            <span>{copy.fieldType}</span>
            <select
              className="input"
              value={editDraft.type}
              onChange={(event) =>
                setEditDraft((current) =>
                  current
                    ? {
                        ...current,
                        type: event.target.value as MaterialType,
                        unit:
                          event.target.value === "video"
                            ? "hours"
                            : event.target.value === "course"
                              ? "lessons"
                              : "pages"
                      }
                    : current
                )
              }
            >
              {MATERIAL_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {getMaterialTypeLabel(copy, type)}
                </option>
              ))}
            </select>
          </label>

          <label className="materials-form-field">
            <span>{copy.fieldUnit}</span>
            <input
              type="text"
              className="input"
              value={getMaterialUnitLabel(copy, editDraft.unit as MaterialUnit)}
              readOnly
              disabled
            />
          </label>

          <label className="materials-form-field">
            <span>{copy.fieldTotalAmount}</span>
            <input
              type="number"
              min={0}
              className="input"
              value={editDraft.totalAmount}
              onChange={(event) =>
                setEditDraft((current) =>
                  current
                    ? {
                        ...current,
                        totalAmount: event.target.value
                      }
                    : current
                )
              }
            />
          </label>

          <label className="materials-form-field">
            <span>{copy.fieldCompletedAmount}</span>
            <input
              type="number"
              min={0}
              className="input"
              value={editDraft.completedAmount}
              onChange={(event) =>
                setEditDraft((current) =>
                  current
                    ? {
                        ...current,
                        completedAmount: event.target.value
                      }
                    : current
                )
              }
            />
          </label>

          <label className="materials-form-field">
            <span>{copy.fieldPosition}</span>
            <input
              type="number"
              min={1}
              className="input"
              value={editDraft.position}
              onChange={(event) =>
                setEditDraft((current) =>
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

          <label className="materials-form-field materials-form-field-description">
            <span>{copy.fieldDescription}</span>
            <textarea
              value={editDraft.description}
              onChange={(event) =>
                setEditDraft((current) =>
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

          <label className="materials-form-field">
            <span>{copy.fieldUrl}</span>
            <input
              type="url"
              className="input"
              value={editDraft.url}
              onChange={(event) =>
                setEditDraft((current) =>
                  current
                    ? {
                        ...current,
                        url: event.target.value
                      }
                    : current
                )
              }
              placeholder={copy.createPlaceholderUrl}
            />
          </label>

          <div className="materials-edit-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={updatingMaterialId === material.id}
            >
              {copy.save}
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={onCancelEdit}
              disabled={updatingMaterialId === material.id}
            >
              {copy.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

export function MaterialsLibraryView() {
  const { language } = useUserPreferences();
  const copy = COPY[language];
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const createModalTriggerRef = useRef<HTMLElement | null>(null);
  const createModalTitleId = "materials-create-modal-title";

  const {
    filters,
    setFilters,
    createDraft,
    setCreateDraft,
    editingId,
    editDraft,
    setEditDraft,
    isCreating,
    updatingMaterialId,
    mutationError,
    clearMutationError,
    materialsQuery,
    availableTopics,
    handleCreate,
    startEditing,
    cancelEditing,
    handleEditSubmit,
    handleDelete,
    computeProgressPercent
  } = useMaterialsLibraryViewModel(copy);

  const materials = materialsQuery.data?.materials ?? [];
  const resultsCount = materials.length;

  useEffect(() => {
    if (!isCreateModalOpen) {
      return;
    }

    function handleEscClose(event: KeyboardEvent) {
      if (event.key !== "Escape" || isCreating) {
        return;
      }
      clearMutationError();
      setIsCreateModalOpen(false);
      createModalTriggerRef.current?.focus();
      createModalTriggerRef.current = null;
    }

    document.addEventListener("keydown", handleEscClose);
    return () => document.removeEventListener("keydown", handleEscClose);
  }, [isCreateModalOpen, isCreating, clearMutationError]);

  function openCreateModal(triggerElement: HTMLElement) {
    clearMutationError();
    createModalTriggerRef.current = triggerElement;
    setIsCreateModalOpen(true);
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
    <section className="materials-library-view">
      <MaterialsLibraryHeader
        copy={copy}
        query={filters.query}
        topicId={filters.topicId}
        topics={availableTopics}
        resultsCount={resultsCount}
        onQueryChange={(query) =>
          setFilters((current) => ({
            ...current,
            query
          }))
        }
        onTopicChange={(topicId) =>
          setFilters((current) => ({
            ...current,
            topicId
          }))
        }
        onCreateClick={openCreateModal}
        materials={materials}
      />

      {isCreateModalOpen ? (
        <div className="roadmap-modal-overlay" role="presentation" onClick={closeCreateModal}>
          <section
            className="roadmap-modal materials-create-modal"
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

            <MaterialsCreatePanel
              copy={copy}
              createDraft={createDraft}
              setCreateDraft={setCreateDraft}
              availableTopics={availableTopics}
              isCreating={isCreating}
              onSubmit={handleCreateSubmit}
              includePanelStyles={false}
              error={mutationError}
            />
          </section>
        </div>
      ) : null}

      {mutationError && !isCreateModalOpen ? (
        <div className="dashboard-error">
          <p>{mutationError}</p>
        </div>
      ) : null}

      {materialsQuery.isPending ? (
        <section className="panel materials-loading-panel">
          <p className="materials-loading-title">{copy.loading}</p>
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>
      ) : null}

      {materialsQuery.isError ? (
        <section className="panel materials-error-panel">
          <div className="dashboard-error">
            <p>{materialsQuery.error?.message ?? copy.loadFailed}</p>
            <button
              type="button"
              className="button button-outline dashboard-retry"
              onClick={() => {
                void materialsQuery.refetch();
              }}
            >
              {copy.retry}
            </button>
          </div>
        </section>
      ) : null}

      {materialsQuery.status === "success" && materialsQuery.data ? (
        resultsCount > 0 ? (
          <ul className="materials-grid">
            {materials.map((material) => (
              <MaterialsCard
                key={material.id}
                copy={copy}
                material={material}
                availableTopics={availableTopics}
                editingId={editingId}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                updatingMaterialId={updatingMaterialId}
                onEditStart={startEditing}
                onDelete={handleDelete}
                computeProgressPercent={computeProgressPercent}
                onEditSubmit={handleEditSubmit}
                onCancelEdit={cancelEditing}
              />
            ))}
          </ul>
        ) : (
          <section className="panel materials-empty-panel">
            <p className="dashboard-empty">{copy.empty}</p>
          </section>
        )
      ) : null}
    </section>
  );
}
