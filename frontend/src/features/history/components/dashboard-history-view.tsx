"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@features/auth/lib/auth-fetch";
import type { DashboardHistoryEvent } from "@features/dashboard/types";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";
import { formatDashboardDate } from "@features/dashboard/hooks/use-dashboard-view-model";

type LoadStatus = "loading" | "success" | "error";

interface HistoryState {
  status: LoadStatus;
  data: DashboardHistoryEvent[];
  errorMessage: string | null;
}

function initialState(): HistoryState {
  return {
    status: "loading",
    data: [],
    errorMessage: null
  };
}

async function fetchHistory(signal: AbortSignal): Promise<DashboardHistoryEvent[]> {
  const response = await authFetch("/api/dashboard/history?limit=50", {
    method: "GET",
    signal
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload?.message === "string") {
        message = payload.message;
      }
    } catch {
      // Ignore non-JSON body.
    }

    throw new Error(message);
  }

  return (await response.json()) as DashboardHistoryEvent[];
}

function formatHistorySubtitle(entry: DashboardHistoryEvent, locale: string, noDateLabel: string): string {
  const createdAt = formatDashboardDate(entry.createdAt, locale, noDateLabel);
  return `${entry.entityType} · ${entry.eventType} · ${createdAt}`;
}

export function DashboardHistoryView() {
  const { language, copy } = useUserPreferences();
  const dashboardCopy = copy.dashboard;
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const [state, setState] = useState<HistoryState>(initialState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setState(initialState());
      try {
        const payload = await fetchHistory(controller.signal);
        setState({
          status: "success",
          data: payload,
          errorMessage: null
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

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
    <section className="panel" style={{ display: "grid", gap: "14px" }}>
      <header>
        <h2 style={{ margin: 0 }}>{header.title}</h2>
        <p style={{ marginTop: "6px" }}>{header.description}</p>
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

      {state.status === "success" ? (
        state.data.length === 0 ? (
          <p className="dashboard-empty">{dashboardCopy.historyEmpty}</p>
        ) : (
          <ul className="dashboard-list">
            {state.data.map((entry) => (
              <li key={entry.id} className="dashboard-list-item">
                <div>
                  <p className="dashboard-list-title">{entry.eventName}</p>
                  <p className="dashboard-list-subtitle">
                    {formatHistorySubtitle(entry, locale, dashboardCopy.noDate)}
                  </p>
                </div>
                <span className="dashboard-badge">{entry.eventType}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}

      <div>
        <Link href="/dashboard" className="button button-outline" style={{ display: "inline-flex", alignItems: "center" }}>
          {copy.navigation.dashboardLabel}
        </Link>
      </div>
    </section>
  );
}
