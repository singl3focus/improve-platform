"use client";

import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import type { AppLanguage, AppTheme } from "@/lib/ui-copy";

export default function SettingsPage() {
  const { copy, language, setLanguage, theme, setTheme } = useUserPreferences();

  return (
    <section className="panel settings-view">
      <h2>{copy.settings.title}</h2>
      <p>{copy.settings.description}</p>

      <div className="settings-control-grid">
        <label className="settings-control">
          <span>{copy.settings.languageLabel}</span>
          <select
            className="input"
            value={language}
            onChange={(event) => setLanguage(event.target.value as AppLanguage)}
          >
            <option value="ru">{copy.settings.languageRu}</option>
            <option value="en">{copy.settings.languageEn}</option>
          </select>
        </label>

        <label className="settings-control">
          <span>{copy.settings.themeLabel}</span>
          <select
            className="input"
            value={theme}
            onChange={(event) => setTheme(event.target.value as AppTheme)}
          >
            <option value="light">{copy.settings.themeLight}</option>
            <option value="dark">{copy.settings.themeDark}</option>
          </select>
        </label>
      </div>

      <p className="settings-note">{copy.settings.applyNote}</p>
    </section>
  );
}
