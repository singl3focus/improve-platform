"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { DashboardHistoryEvent } from "@features/dashboard/types";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { formatDashboardDate } from "@features/dashboard/hooks/use-dashboard-view-model";
import {
  formatHistoryEventTitle,
  formatHistoryEventSubtitle,
  formatHistoryEventBadge
} from "@features/history/lib/format-history-event";

type LoadStatus = "loading" | "success" | "error";

interface HistoryState {
  status: LoadStatus;
  data: DashboardHistoryEvent[];
  errorMessage: string | null;
}

function initialState(): HistoryState {
  return { status: "loading", data: [], errorMessage: null };
}

async function fetchHistory(signal: AbortSignal): Promise<DashboardHistoryEvent[]> {
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
  const [state, setState] = useState<HistoryState>(initialState);
  const [reloadKey, setReloadKey] = useState(0);

  const historyCopy =
    language === "ru"
      ? {
          eyebrow: "Лента активности",
          lead: "Последовательность последних действий по темам, задачам и материалам.",
          returnLabel: "Вернуться к dashboard"
        }
      : {
          eyebrow: "Activity feed",
          lead: "A readable sequence of recent actions across topics, tasks, and materials.",
          returnLabel: "Back to dashboard"
        };

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState(initialState());
      try {
        const payload = await fetchHistory(controller.signal);
        setState({ status: "success", data: payload, errorMessage: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: [],
          errorMessage: error instanceof Error ? error.message : dashboardCopy.historyLoadFailed
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [dashboardCopy.historyLoadFailed, reloadKey]);

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

        {state.status === "loading" ? (
          <div className="dashboard-loading" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="dashboard-error">
            <p>{state.errorMessage ?? dashboardCopy.historyLoadFailed}</p>
            <button
              type="button"
              className="button button-outline dashboard-retry"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              {dashboardCopy.retry}
            </button>
          </div>
        ) : null}

        {state.status === "success" && state.data.length === 0 ? (
          <p className="dashboard-empty">{dashboardCopy.historyEmpty}</p>
        ) : null}

        {state.status === "success" && state.data.length > 0 ? (
          <ol className="history-feed-list">
            {state.data.map((entry) => (
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
