"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import type { AppLanguage, AppTheme } from "@/lib/ui-copy";

interface PreferencesControlsProps {
  className?: string;
  controlClassName?: string;
  variant?: "default" | "mini";
}

export function PreferencesControls({
  className,
  controlClassName,
  variant = "default"
}: PreferencesControlsProps) {
  const { copy, language, setLanguage, theme, setTheme } = useUserPreferences();

  if (variant === "mini") {
    const nextLanguage: AppLanguage = language === "ru" ? "en" : "ru";
    const nextTheme: AppTheme = theme === "light" ? "dark" : "light";

    return (
      <div className={className}>
        <button
          type="button"
          className="sidebar-preference-mini"
          onClick={() => setLanguage(nextLanguage)}
          aria-label={`${copy.settings.languageLabel}: ${language.toUpperCase()}`}
          title={copy.settings.languageLabel}
        >
          <Languages size={14} aria-hidden="true" />
          <span>{language.toUpperCase()}</span>
        </button>
        <button
          type="button"
          className="sidebar-preference-mini"
          onClick={() => setTheme(nextTheme)}
          aria-label={`${copy.settings.themeLabel}: ${theme === "light" ? copy.settings.themeLight : copy.settings.themeDark}`}
          title={copy.settings.themeLabel}
        >
          {theme === "light" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
          <span>{theme === "light" ? copy.settings.themeLight : copy.settings.themeDark}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={className ?? ""}>
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
