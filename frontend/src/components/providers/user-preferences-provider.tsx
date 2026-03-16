"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { type AppCopy, type AppLanguage, type AppTheme, getAppCopy } from "@/lib/ui-copy";

const LANGUAGE_STORAGE_KEY = "improve_ui_language";
const THEME_STORAGE_KEY = "improve_ui_theme";

interface UserPreferencesContextValue {
  language: AppLanguage;
  theme: AppTheme;
  copy: AppCopy;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function parseLanguage(value: string | null): AppLanguage | null {
  if (value === "ru" || value === "en") {
    return value;
  }
  return null;
}

function parseTheme(value: string | null): AppTheme | null {
  if (value === "light" || value === "dark") {
    return value;
  }
  return null;
}

function getSystemLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "en";
  }
  return window.navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function getSystemTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function UserPreferencesProvider({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [theme, setTheme] = useState<AppTheme>("light");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const storedLanguage = parseLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    const storedTheme = parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));

    const nextLanguage = storedLanguage ?? getSystemLanguage();
    const nextTheme = storedTheme ?? getSystemTheme();

    setLanguage(nextLanguage);
    setTheme(nextTheme);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [isInitialized, language]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [isInitialized, theme]);

  const contextValue = useMemo<UserPreferencesContextValue>(() => {
    return {
      language,
      theme,
      copy: getAppCopy(language),
      setLanguage,
      setTheme
    };
  }, [language, theme]);

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error("useUserPreferences must be used within UserPreferencesProvider");
  }
  return context;
}
