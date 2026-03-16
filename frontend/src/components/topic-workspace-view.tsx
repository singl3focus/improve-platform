"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import { useTopicWorkspaceViewModel } from "@/components/hooks/use-topic-workspace-view-model";
import type { AppLanguage } from "@/lib/ui-copy";
import type {
  TopicChecklistStatus,
  TopicWorkspace,
  TopicWorkspaceStatus
} from "@/lib/topic-workspace-types";

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
    dependenciesSummary: (completed: number, blocked: number) =>
      `Выполнено: ${completed} · Заблокировано: ${blocked}`,
    noDependencies: "Для этой темы нет зависимостей.",
    dependencyRequired: "Обязательная зависимость",
    dependencyOptional: "Необязательная зависимость",
    dependencyReady: "Готово",
    dependencyBlocked: "Заблокировано",
    checklistTitle: "Чеклист / Задачи",
    checklistSubtitle: "Статусы доступны для изменения в разделе /tasks.",
    checklistEmpty: "Для этой темы чеклист пуст.",
    statusLabel: "Статус",
    materialsTitle: "Материалы",
    materialsSubtitle: "Сортировка по позиции из backend.",
    materialsEmpty: "Пока нет материалов по этой теме.",
    progress: "Прогресс"
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
    dependenciesSummary: (completed: number, blocked: number) =>
      `Completed: ${completed} · Blocked: ${blocked}`,
    noDependencies: "No dependencies for this topic.",
    dependencyRequired: "Required dependency",
    dependencyOptional: "Optional dependency",
    dependencyReady: "Ready",
    dependencyBlocked: "Blocked",
    checklistTitle: "Checklist / Tasks",
    checklistSubtitle: "Statuses can be changed in the /tasks section.",
    checklistEmpty: "Checklist is empty for this topic.",
    statusLabel: "Status",
    materialsTitle: "Materials",
    materialsSubtitle: "Ordered by backend position field.",
    materialsEmpty: "No materials in this topic yet.",
    progress: "Progress"
  }
} as const;

type TopicCopy = (typeof TOPIC_COPY)[keyof typeof TOPIC_COPY];

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

function mapTopicStatusClassName(status: TopicWorkspaceStatus): string {
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

function mapChecklistStatusLabel(status: TopicChecklistStatus, language: AppLanguage): string {
  if (language === "ru") {
    if (status === "done") {
      return "Сделано";
    }
    if (status === "in_progress") {
      return "В работе";
    }
    return "К выполнению";
  }

  if (status === "done") {
    return "Done";
  }
  if (status === "in_progress") {
    return "In progress";
  }
  return "Todo";
}

function mapChecklistStatusClassName(status: TopicChecklistStatus): string {
  if (status === "done") {
    return "roadmap-status-completed";
  }
  if (status === "in_progress") {
    return "roadmap-status-in-progress";
  }
  return "roadmap-status-not-started";
}

function TopicHeroPanel({
  topic,
  copy,
  language
}: {
  topic: TopicWorkspace;
  copy: TopicCopy;
  language: AppLanguage;
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
        <div>
          <span>{copy.startDate}</span>
          <strong>{formatDate(topic.startDate, language, copy.notSet)}</strong>
        </div>
        <div>
          <span>{copy.targetDate}</span>
          <strong>{formatDate(topic.targetDate, language, copy.notSet)}</strong>
        </div>
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
  blocked
}: {
  topic: TopicWorkspace;
  copy: TopicCopy;
  completed: number;
  blocked: number;
}) {
  return (
    <aside className="topic-dependencies panel">
      <header>
        <h3>{copy.dependenciesTitle}</h3>
        <p>{copy.dependenciesSummary(completed, blocked)}</p>
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
              {dependency.isCompleted ? (
                <span className="roadmap-status-badge roadmap-status-completed">
                  {copy.dependencyReady}
                </span>
              ) : (
                <span className="roadmap-blocked-badge">{copy.dependencyBlocked}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function TopicChecklistPanel({
  topic,
  copy,
  language
}: {
  topic: TopicWorkspace;
  copy: TopicCopy;
  language: AppLanguage;
}) {
  return (
    <section className="topic-checklist panel">
      <header>
        <h3>{copy.checklistTitle}</h3>
        <p>{copy.checklistSubtitle}</p>
      </header>
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

function TopicMaterialsPanel({ topic, copy }: { topic: TopicWorkspace; copy: TopicCopy }) {
  return (
    <section className="topic-materials panel">
      <header>
        <h3>{copy.materialsTitle}</h3>
        <p>{copy.materialsSubtitle}</p>
      </header>
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
  const { state, reload, dependencySummary } = useTopicWorkspaceViewModel(topicId, copy.loadError);

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
          <TopicHeroPanel topic={state.data} copy={copy} language={language} />

          <div className="topic-grid">
            <TopicDependenciesPanel
              topic={state.data}
              copy={copy}
              completed={dependencySummary.completed}
              blocked={dependencySummary.blocked}
            />
            <TopicChecklistPanel
              topic={state.data}
              copy={copy}
              language={language}
            />
            <TopicMaterialsPanel topic={state.data} copy={copy} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
