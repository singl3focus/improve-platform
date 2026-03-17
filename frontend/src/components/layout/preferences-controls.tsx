"use client";

import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import type { AppLanguage, AppTheme } from "@/lib/ui-copy";

interface PreferencesControlsProps {
  className: string;
  controlClassName: string;
}

export function PreferencesControls({ className, controlClassName }: PreferencesControlsProps) {
  const { copy, language, setLanguage, theme, setTheme } = useUserPreferences();

  return (
    <div className={className}>
      <label className={controlClassName}>
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

      <label className={controlClassName}>
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
  );
}
