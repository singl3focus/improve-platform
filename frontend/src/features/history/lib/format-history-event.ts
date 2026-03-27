import type { AppLanguage } from "@shared/i18n/ui-copy";
import type { DashboardHistoryEvent } from "@features/dashboard/types";

interface EntityTypeLabels {
  topic: string;
  task: string;
  material: string;
}

interface EventNameTemplates {
  "entity.created": (entity: string) => string;
  "entity.updated": (entity: string) => string;
  "entity.deleted": (entity: string) => string;
  "topic.status_changed": () => string;
  "task.deadline_changed": () => string;
  "task.completed": () => string;
  "topic.progress_changed": () => string;
}

const ENTITY_TYPE_LABELS: Record<AppLanguage, EntityTypeLabels> = {
  ru: { topic: "тему", task: "задачу", material: "материал" },
  en: { topic: "topic", task: "task", material: "material" }
};

const ENTITY_TYPE_LABELS_SUBJECT: Record<AppLanguage, EntityTypeLabels> = {
  ru: { topic: "Тема", task: "Задача", material: "Материал" },
  en: { topic: "Topic", task: "Task", material: "Material" }
};

const EVENT_NAME_TEMPLATES: Record<AppLanguage, EventNameTemplates> = {
  ru: {
    "entity.created": (entity) => `Создан${entity === "задачу" ? "а" : ""} ${entity}`,
    "entity.updated": (entity) => `Обновлен${entity === "задачу" ? "а" : ""} ${entity}`,
    "entity.deleted": (entity) => `Удален${entity === "задачу" ? "а" : ""} ${entity}`,
    "topic.status_changed": () => "Изменён статус темы",
    "task.deadline_changed": () => "Изменён дедлайн задачи",
    "task.completed": () => "Задача завершена",
    "topic.progress_changed": () => "Изменён прогресс темы"
  },
  en: {
    "entity.created": (entity) => `Created ${entity}`,
    "entity.updated": (entity) => `Updated ${entity}`,
    "entity.deleted": (entity) => `Deleted ${entity}`,
    "topic.status_changed": () => "Topic status changed",
    "task.deadline_changed": () => "Task deadline changed",
    "task.completed": () => "Task completed",
    "topic.progress_changed": () => "Topic progress changed"
  }
};

export function formatHistoryEventTitle(entry: DashboardHistoryEvent, language: AppLanguage): string {
  const templates = EVENT_NAME_TEMPLATES[language];
  const entityLabels = ENTITY_TYPE_LABELS[language];
  const entityType = entry.entityType as keyof EntityTypeLabels;
  const entityLabel = entityLabels[entityType] ?? entry.entityType;

  const eventName = entry.eventName as keyof EventNameTemplates;
  const template = templates[eventName];

  if (!template) {
    return entry.eventName;
  }

  if (eventName === "entity.created" || eventName === "entity.updated" || eventName === "entity.deleted") {
    return (template as (entity: string) => string)(entityLabel);
  }

  return (template as () => string)();
}

export function formatHistoryEventSubtitle(
  entry: DashboardHistoryEvent,
  language: AppLanguage,
  formattedDate: string
): string {
  const subjectLabels = ENTITY_TYPE_LABELS_SUBJECT[language];
  const entityType = entry.entityType as keyof EntityTypeLabels;
  const entityLabel = subjectLabels[entityType] ?? entry.entityType;

  return `${entityLabel} · ${formattedDate}`;
}

export function formatHistoryEventBadge(entry: DashboardHistoryEvent, language: AppLanguage): string {
  const eventType = entry.eventType;

  if (language === "ru") {
    return eventType === "business" ? "Действие" : "Система";
  }

  return eventType === "business" ? "Action" : "System";
}
