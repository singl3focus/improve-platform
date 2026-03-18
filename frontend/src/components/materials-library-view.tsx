"use client";

import Link from "next/link";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import {
  type MaterialDraft,
  useMaterialsLibraryViewModel
} from "@/components/hooks/use-materials-library-view-model";
import type { LibraryMaterial, MaterialType } from "@/lib/materials-library-types";

const MATERIALS_COPY = {
  ru: {
    title: "Личная библиотека материалов",
    subtitle: "Просматривайте, обновляйте и упорядочивайте материалы по темам.",
    search: "Поиск",
    topic: "Тема",
    allTopics: "Все темы",
    searchPlaceholder: "Название, описание, тема",
    createTitle: "Добавить материал",
    createSubtitle: "Создайте новый элемент и задайте позицию в выбранной теме.",
    fieldTitle: "Название",
    fieldDescription: "Описание",
    fieldType: "Тип",
    fieldUnit: "Единица",
    fieldTotalAmount: "Полная мера",
    fieldCompletedAmount: "Выполнено",
    fieldPosition: "Позиция",
    fieldTopic: "Тема",
    typeBook: "Книга",
    typeArticle: "Статья",
    typeCourse: "Курс",
    typeVideo: "Видео",
    createPlaceholderTitle: "Название материала",
    createPlaceholderDescription: "Описание материала",
    noTopicsAvailable: "Нет доступных тем",
    createButton: "Создать материал",
    createModalTitle: "Создать материал",
    closeModalAria: "Закрыть окно создания материала",
    creatingButton: "Создание...",
    topicRequired: "Для создания материала нужна тема.",
    titleDescriptionRequired: "Название и описание обязательны.",
    amountInvalid: "Выполненная мера должна быть меньше или равна полной мере.",
    createFailed: "Не удалось создать материал.",
    updateFailed: "Не удалось обновить материал.",
    deleteFailed: "Не удалось удалить материал.",
    loading: "Загрузка библиотеки материалов...",
    loadFailed: "Не удалось загрузить библиотеку материалов.",
    retry: "Повторить",
    progress: "Прогресс",
    updateProgress: "Обновить прогресс",
    edit: "Редактировать",
    delete: "Удалить",
    save: "Сохранить",
    cancel: "Отмена",
    empty: "Материалы по текущим фильтрам не найдены. Измените фильтр или добавьте новый элемент."
  },
  en: {
    title: "Curated materials library",
    subtitle: "Browse, update and organize learning materials with topic-aware ordering.",
    search: "Search",
    topic: "Topic",
    allTopics: "All topics",
    searchPlaceholder: "Title, description, topic",
    createTitle: "Add material",
    createSubtitle: "Create a new library item and place it at a position inside the selected topic.",
    fieldTitle: "Title",
    fieldDescription: "Description",
    fieldType: "Type",
    fieldUnit: "Unit",
    fieldTotalAmount: "Total amount",
    fieldCompletedAmount: "Completed amount",
    fieldPosition: "Position",
    fieldTopic: "Topic",
    typeBook: "Book",
    typeArticle: "Article",
    typeCourse: "Course",
    typeVideo: "Video",
    createPlaceholderTitle: "Material title",
    createPlaceholderDescription: "Material description",
    noTopicsAvailable: "No topics available",
    createButton: "Create material",
    createModalTitle: "Create material",
    closeModalAria: "Close material creation modal",
    creatingButton: "Creating...",
    topicRequired: "Topic is required for material creation.",
    titleDescriptionRequired: "Title and description are required.",
    amountInvalid: "Completed amount must be less than or equal to total amount.",
    createFailed: "Material creation failed.",
    updateFailed: "Material update failed.",
    deleteFailed: "Material removal failed.",
    loading: "Loading materials library...",
    loadFailed: "Materials library failed to load.",
    retry: "Retry",
    progress: "Progress",
    updateProgress: "Update progress",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    empty: "No materials found for the current filters. Try another topic or add a new item."
  }
} as const;

type MaterialsCopy = (typeof MATERIALS_COPY)[keyof typeof MATERIALS_COPY];

const MATERIAL_TYPE_OPTIONS: MaterialType[] = ["book", "article", "course", "video"];

function getMaterialTypeLabel(copy: MaterialsCopy, type: MaterialType): string {
  if (type === "book") {
    return copy.typeBook;
  }
  if (type === "article") {
    return copy.typeArticle;
  }
  if (type === "course") {
    return copy.typeCourse;
  }

  return copy.typeVideo;
}

interface TopicOption {
  id: string;
  title: string;
}

function MaterialsLibraryHeader({
  copy,
  query,
  topicId,
  topics,
  onQueryChange,
  onTopicChange,
  onCreateClick
}: {
  copy: MaterialsCopy;
  query: string;
  topicId: string;
  topics: TopicOption[];
  onQueryChange: (query: string) => void;
  onTopicChange: (topicId: string) => void;
  onCreateClick: (triggerElement: HTMLElement) => void;
}) {
  return (
    <header className="materials-library-header">
      <div className="materials-library-intro">
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
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

          <button
            type="button"
            className="button button-primary materials-create-trigger"
            onClick={(event) => onCreateClick(event.currentTarget)}
          >
            {copy.createButton}
          </button>
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
  includePanelStyles = true
}: {
  copy: MaterialsCopy;
  createDraft: MaterialDraft;
  setCreateDraft: Dispatch<SetStateAction<MaterialDraft>>;
  availableTopics: TopicOption[];
  isCreating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  includePanelStyles?: boolean;
}) {
  const rootClassName = includePanelStyles ? "panel materials-create-panel" : "materials-create-panel";

  return (
    <section className={rootClassName}>
      <header>
        <h3>{copy.createTitle}</h3>
        <p>{copy.createSubtitle}</p>
      </header>

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
          <input type="text" className="input" value={createDraft.unit} readOnly disabled />
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
          {material.completedAmount}/{material.totalAmount} {material.unit}
        </span>
      </div>

      <h3>{material.title}</h3>
      <p>{material.description}</p>

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
            <input type="text" className="input" value={editDraft.unit} readOnly disabled />
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
  const copy = MATERIALS_COPY[language];
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
            />

            {mutationError ? (
              <div className="dashboard-error">
                <p>{mutationError}</p>
              </div>
            ) : null}

            <div className="roadmap-modal-actions">
              <button type="button" className="button button-outline" onClick={closeCreateModal}>
                {copy.cancel}
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
        materialsQuery.data.materials.length > 0 ? (
          <ul className="materials-grid">
            {materialsQuery.data.materials.map((material) => (
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
          <section className="panel">
            <p className="dashboard-empty">{copy.empty}</p>
          </section>
        )
      ) : null}
    </section>
  );
}
