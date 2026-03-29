"use client";

import { ProfileView } from "@features/profile/components/profile-view";
import { useUserPreferences } from "@shared/providers/user-preferences-provider";

export default function SettingsPage() {
  const { copy, language, theme } = useUserPreferences();

  const settingsCopy =
    language === "ru"
      ? {
          eyebrow: "Параметры",
          lead: "Базовые настройки интерфейса и идентичности рабочего пространства.",
          currentLabel: "Текущее состояние",
          languageValue: "Русский",
          themeValue: "Светлая",
          modeLabel: "Режим",
          modeValue: "Локальная конфигурация",
          noteTitle: "Примечание",
          noteBody: "Язык и тема сейчас зафиксированы на уровне текущей сборки. Экран уже приведён к новому визуальному слою и готов к подключению полноценного переключения позже."
        }
      : {
          eyebrow: "Settings",
          lead: "Core interface and identity settings for the workspace.",
          currentLabel: "Current state",
          languageValue: "Russian",
          themeValue: "Light",
          modeLabel: "Mode",
          modeValue: "Local configuration",
          noteTitle: "Note",
          noteBody: "Language and theme are currently fixed at the app-build level. The screen is already aligned with the new visual layer and is ready for real switching logic later."
        };

  return (
    <section className="settings-page">
      <section className="panel settings-hero">
        <div className="settings-hero-copy">
          <p className="dashboard-eyebrow">{settingsCopy.eyebrow}</p>
          <h2>{copy.settings.title}</h2>
          <p>{settingsCopy.lead}</p>
        </div>

        <div className="settings-summary-grid">
          <article className="settings-summary-card">
            <span>{copy.settings.languageLabel}</span>
            <strong>{language === "ru" ? settingsCopy.languageValue : copy.settings.languageEn}</strong>
          </article>
          <article className="settings-summary-card">
            <span>{copy.settings.themeLabel}</span>
            <strong>{theme === "light" ? settingsCopy.themeValue : copy.settings.themeDark}</strong>
          </article>
          <article className="settings-summary-card">
            <span>{settingsCopy.modeLabel}</span>
            <strong>{settingsCopy.modeValue}</strong>
          </article>
          <article className="settings-summary-card">
            <span>{settingsCopy.currentLabel}</span>
            <strong>{copy.settings.applyNote}</strong>
          </article>
        </div>
      </section>

      <section className="panel settings-overview">
        <header>
          <p className="topic-card-kicker">{settingsCopy.noteTitle}</p>
          <h3>{copy.settings.description}</h3>
        </header>
        <p>{settingsCopy.noteBody}</p>
      </section>

      <ProfileView />
    </section>
  );
}
