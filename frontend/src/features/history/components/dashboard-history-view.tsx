"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { DashboardHistoryEvent } from "@features/dashboard/types";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { formatDashboardDate } from "@features/dashboard/hooks/use-dashboard-view-model";
import {
  formatHistoryEventTitle,
  formatHistoryEventSubtitle,
  formatHistoryEventBadge
} from "@features/history/lib/format-history-event";

async function fetchHistory(signal?: AbortSignal): Promise<DashboardHistoryEvent[]> {
  const response = await authFetch("/api/dashboard/history?limit=50", { method: "GET", signal });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload?.message === "string") message = payload.message;
    } catch {
      // Ignore non-JSON body.
    }
    throw new Error(message);
  }
  return (await response.json()) as DashboardHistoryEvent[];
}

export function DashboardHistoryView() {
  const { language, copy } = useUserPreferences();
  const dashboardCopy = copy.dashboard;
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const historyQuery = useQuery({
    queryKey: ["dashboard-history", 50],
    queryFn: ({ signal }) => fetchHistory(signal),
    retry: false
  });

  const historyCopy =
    language === "ru"
      ? {
          eyebrow: "Р›РµРЅС‚Р° Р°РєС‚РёРІРЅРѕСЃС‚Рё",
          lead: "РџРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚СЊ РїРѕСЃР»РµРґРЅРёС… РґРµР№СЃС‚РІРёР№ РїРѕ С‚РµРјР°Рј, Р·Р°РґР°С‡Р°Рј Рё РјР°С‚РµСЂРёР°Р»Р°Рј.",
          returnLabel: "Р’РµСЂРЅСѓС‚СЊСЃСЏ Рє dashboard"
        }
      : {
          eyebrow: "Activity feed",
          lead: "A readable sequence of recent actions across topics, tasks, and materials.",
          returnLabel: "Back to dashboard"
        };

  const header = useMemo(
    () => ({
      title: dashboardCopy.historyDetailsTitle,
      description: dashboardCopy.historyDetailsDescription
    }),
    [dashboardCopy.historyDetailsDescription, dashboardCopy.historyDetailsTitle]
  );

  return (
    <section className="history-view">
      <section className="panel history-hero">
        <div>
          <p className="dashboard-eyebrow">{historyCopy.eyebrow}</p>
          <h2>{header.title}</h2>
          <p>{historyCopy.lead}</p>
        </div>
        <Link href="/dashboard" className="button button-outline history-return-link">
          {historyCopy.returnLabel}
        </Link>
      </section>

      <section className="panel history-feed-panel">
        <header className="history-feed-header">
          <div>
            <p className="topic-card-kicker">{header.title}</p>
            <h3>{header.title}</h3>
            <p>{header.description}</p>
          </div>
        </header>

        {historyQuery.isPending ? (
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {historyQuery.isError ? (
          <div className="dashboard-error">
            <p>{historyQuery.error instanceof Error ? historyQuery.error.message : dashboardCopy.historyLoadFailed}</p>
            <button
              type="button"
              className="button button-outline dashboard-retry"
              onClick={() => {
                void historyQuery.refetch();
              }}
            >
              {dashboardCopy.retry}
            </button>
          </div>
        ) : null}

        {historyQuery.isSuccess && historyQuery.data.length === 0 ? (
          <p className="dashboard-empty">{dashboardCopy.historyEmpty}</p>
        ) : null}

        {historyQuery.isSuccess && historyQuery.data.length > 0 ? (
          <ol className="history-feed-list">
            {historyQuery.data.map((entry) => (
              <li key={entry.id} className="history-feed-item">
                <div className="history-feed-marker" aria-hidden="true" />
                <div className="history-feed-card">
                  <div className="history-feed-main">
                    <div>
                      <p className="history-feed-title">{formatHistoryEventTitle(entry, language)}</p>
                      <p className="history-feed-subtitle">
                        {formatHistoryEventSubtitle(
                          entry,
                          language,
                          formatDashboardDate(entry.createdAt, locale, dashboardCopy.noDate)
                        )}
                      </p>
                    </div>
                    <span className="dashboard-badge">{formatHistoryEventBadge(entry, language)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </section>
  );
}
